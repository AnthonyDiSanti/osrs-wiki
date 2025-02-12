-- <nowiki>
local timefunc = require('Module:Time')
local exg = require('Module:Exchange')._price
local sc = require('Module:Skill clickpic')._main
local round = require('Module:Number')._round
local p = {}
local lang = mw.getContentLanguage()

function gep(x)
	return exg(x, 1, nil, nil, 0)
end

local MEMBERS_ICON = {
    [false] = "[[File:F2P icon.png|20px|center|link=Free-to-play|Free-to-play]]",
    [true]  = "[[File:P2P icon.png|20px|center|link=Members|Members]]"
}

local INTENSITY_SORT = {
	Default = 0,
	Low = 1,
	Moderate = 2,
	High = 3,
}
function sigfig(x, p)
	local x_sign = x < 0 and -1 or 1
	local x = math.abs(x)
	local n = math.floor(math.log10(x)) + 1 - p
	return x_sign * math.pow(10, n) * round(x / math.pow(10, n), 0)
end


function autoround(x, f)
	x = tonumber(x) or 0
	local _x
	if x == 0 then
		_x = 0
	elseif math.abs(x) < 0.1 then
		_x = sigfig(x, 2)
	elseif math.abs(x) > 999 then
		_x = round(x, 0)
	else
		_x = round(x, 2)
	end
	if f then
		return lang:formatNum(_x)
	end
	return _x
end

function round1k(x, f)
	if not tonumber(x) then
		return x
	end
	local _x = math.abs(x)
	_x = 1000 * math.floor(_x / 1000 + 0.5)
	if x < 0 then
		_x = _x * -1
	end
	if f then
		return lang:formatNum(_x)
	end
	return _x
end
function round1dp(x, f)
	if not tonumber(x) then
		return x
	end
	local _x = math.abs(x)
	_x = math.floor(_x * 10 + 0.5) / 10
	if x < 0 then
		_x = _x * -1
	end
	if f then
		return lang:formatNum(_x)
	end
	return _x
end

function handle_calc_value(str)
	if type(str) ~= 'string' then
		return str
	end
	local cv
	if string.find(str, '¦') then
		cv = string.gsub(str, '{', '{{')
		cv = string.gsub(cv, '}', '}}')
		cv = string.gsub(cv, '¦', '|')
	end
	cv = tonumber(mw.getCurrentFrame():preprocess(cv)) or 0
	return cv
end

function calc_value(args, kph, deduct_tax)
	local total = 0
	for i,v in ipairs(args) do
		local val = 0
		if v.pricetype == 'value' then
			val = v.qty * v.value
		elseif v.pricetype == 'calcvalue' then
			val = handle_calc_value(v.raw_value) * v.qty
		elseif v.pricetype == 'gemw' then
			local _v = gep(v.name)
			if deduct_tax and _v >= 50 and v.name ~= 'Bond' then
				_v = _v - math.floor(_v * 0.02)
			end
			val = _v * v.qty
		end
		if kph>0 and not v.isph then
			val = val * kph
		end
		total = total + val
	end
	return total
end

function parse_xp(args, kph)
	local out = mw.html.create('td')
	out:addClass('mmg-col-xp')
	if args == nil or #args == 0 then
		out:wikitext("''None''")
		return out
	end
	for i,v in ipairs(args) do
		local span =out:tag('div')
		local xptotal, attrname
		if kph>0 and not v.isph then
			xptotal = v.xp * kph
			span:addClass('mmg-varieswithkph')
			attrname = 'data-mmg-xp-pk'
		else
			xptotal = v.xp
			attrname = 'data-mmg-xp-ph'
		end
		span:attr(attrname, v.xp):wikitext(sc(v.skill, autoround(xptotal, true)))
	end
	return out
end

function make_row(fullpagename, raw_data, ismulti)
	local data = mw.text.jsonDecode(mw.text.decode(raw_data))
	local tr = mw.html.create('tr')
	local pagename, mmgname
	mmgname = string.match(fullpagename, '/(.*)')
	if ismulti and data.version then
		pagelink = fullpagename..'#'..data.version..'|'..string.match(fullpagename, '/(.*)')
		pagename = string.format('[[%s#%s|%s (%s)]]', fullpagename, data.version, mmgname, data.version)
	else
		pagename = '[['..fullpagename..'|'..mmgname..']]'
	end
	
	local roi, val, c_class, c_class_inp
	local inputval = calc_value(data.inputs, data.prices.default_kph or 0, false)
	local outputval = calc_value(data.outputs, data.prices.default_kph or 0, true)
	local xpcell = parse_xp(data.xp, data.prices.default_kph or 0)
	val = outputval - inputval
	c_class_inp = 'coins-neg'
	if math.abs(inputval) < 0.000001 then
		roi = 'N/A'
		c_class_inp = 'coins-zero'
	else
		roi = string.format("%.1f", 100 * val/inputval) .. "%"
	end
	if val > 0 then
		c_class = 'coins-pos'
	elseif val < 0 then
		c_class = 'coins-neg'
	else
		c_class = 'coins-zero'
	end
	tr:addClass('mmg-row')
	tr	:tag('td')
			:addClass('mmg-col-name')
			:wikitext(pagename)
		:done()
		:tag('td')
			:addClass('mmg-col-profit')
			:attr('data-sort-value', val)
			:tag('span')
				:addClass('coins')
				:addClass(c_class)
				:wikitext(round1k(val, true))
			:done()
		:done()
		:tag('td')
			:addClass('mmg-col-input')
			:attr('data-sort-value', inputval)
			:tag('span')
				:addClass('coins')
				:addClass(c_class_inp)
				:wikitext(round1k(inputval, true))
			:done()
		:done()
		:tag('td')
			:addClass('mmg-col-output')
			:attr('data-sort-value', outputval)
			:tag('span')
				:addClass('coins coins-pos')
				:wikitext(round1k(outputval, true))
			:done()
		:done()
		:tag('td')
			:addClass('mmg-col-roi')
			:attr('data-sort-value', roi)
			:tag('span')
				:addClass('coins')
				:addClass(c_class)
				:wikitext(round1dp(roi, true))
			:done()
		:done()
		:tag('td')
			:addClass('mmg-col-skills')
			:addClass('no-list-style')
			:newline()
			:wikitext(data.skill)
			:newline()
		:done()
		:tag('td')
			:addClass('mmg-col-quests')
			:addClass('no-list-style')
			:newline()
			:wikitext(data.quest)
			:newline()
		:done()
		:tag('td')
			:addClass('mmg-col-items')
			:addClass('no-list-style')
			:newline()
			:wikitext(data.item)
			:newline()
		:done()
		:tag('td')
			:addClass('mmg-col-other')
			:addClass('no-list-style')
			:newline()
			:wikitext(data.other)
			:newline()
		:done()
		:node(xpcell)
		:tag('td')
			:addClass('mmg-col-category')
			:wikitext(data.category)
			:attr('data-mmg-category', tostring(data.category):lower())
		:done()
		:tag('td')
			:addClass('mmg-col-intensity')
			:attr('data-sort-value', INTENSITY_SORT[data.intensity] or INTENSITY_SORT["Default"])
			:wikitext(data.intensity)
		:done()
		:tag('td')
			:addClass('mmg-col-membership')
			:wikitext(MEMBERS_ICON[data.members])
			:attr('data-mmg-membership', tostring(data.members))
		:done()
	return val, data.category, tr
end

function p.main(frame)
	local args = frame:getParent().args
	local query = {
		'[[MMG JSON::+]]',
		'[[:+]]', -- Mainspace only
		'?MMG JSON',
		'?=#',
		limit = 10000,
	}
	if args[1] then
		table.insert(query, 2, '[[Category:'..args[1]..']]')
	end
	local main_table = true
	if args.pagenamesearch then
		table.insert(query, 2, '[['..args.pagenamesearch..']]')
		main_table = false
	end
	local data = mw.smw.ask(query)
	
	local t = mw.html.create('table')
	if main_table then
		t:addClass('mmg-hidecol-xp')
	end
	t	:addClass('mmg-table wikitable sortable sticky-header mmg-hidecol-input mmg-hidecol-output mmg-hidecol-quests mmg-hidecol-items mmg-hidecol-other')
		:tag('caption')
			:wikitext('[[Money making guide|All guides]] &bull; [[Money making guide/Collecting|Collecting]] &bull; [[Money making guide/Combat|Combat]] &bull; [[Money making guide/Processing|Processing]] &bull; [[Money making guide/Skilling|Skilling]] &bull; [[Money making guide/Recurring|Recurring]]')
		:done()
		:tag('tr')
			:tag('th')
				:addClass('mmg-col-name')
				:wikitext('Method')
			:done()
			:tag('th')
				:addClass('mmg-col-profit')
				:wikitext('Hourly profit')
			:done()
			:tag('th')
				:addClass('mmg-col-input')
				:wikitext('Input value')
			:done()
			:tag('th')
				:addClass('mmg-col-output')
				:wikitext('Output value')
			:done()
			:tag('th')
				:addClass('mmg-col-roi')
				:wikitext('[[wikipedia:Return on investment|ROI]]')
			:done()
			:tag('th')
				:addClass('mmg-col-skills')
				:wikitext('Skills required')
			:done()
			:tag('th')
				:addClass('mmg-col-quests')
				:wikitext('Quests required')
			:done()
			:tag('th')
				:addClass('mmg-col-items')
				:wikitext('Items required')
			:done()
			:tag('th')
				:addClass('mmg-col-other')
				:wikitext('Other requirements')
			:done()
			:tag('th')
				:addClass('mmg-col-xp')
				:wikitext('Experience')
			:done()
			:tag('th')
				:addClass('mmg-col-category')
				:wikitext('Category')
			:done()
			:tag('th')
				:addClass('mmg-col-intensity')
				:wikitext('Intensity')
				:css('width', '65px')
			:done()
			:tag('th')
				:addClass('mmg-col-membership')
				:wikitext('Members')
				:css('width', '65px')
			:done()
			
	local methods = {}
	for i,v in ipairs(data) do
		if type(v['MMG JSON']) == 'table' then
			for j,u in ipairs(v['MMG JSON']) do
				table.insert(methods, { make_row(v[1], u, true) })
			end
		else
			table.insert(methods, { make_row(v[1], v['MMG JSON'], false) })
		end
	end
	table.sort(methods, function(a,b) return a[1]>b[1] end)
	for i,v in ipairs(methods) do
		if v[1] > 0 then
			t:newline():node(v[3])
		end
	end
	return t
end



function make_rec_row(fullpagename, raw_data, ismulti)
	local data = mw.text.jsonDecode(mw.text.decode(raw_data))
	local tr = mw.html.create('tr')
	local pagename, mmgname
	mmgname = string.match(fullpagename, '/(.*)')
	if ismulti and data.version then
		pagelink = fullpagename..'#'..data.version..'|'..string.match(fullpagename, '/(.*)')
		pagename = string.format('[[%s#%s|%s (%s)]]', fullpagename, data.version, mmgname, data.version)
	else
		pagename = '[['..fullpagename..'|'..mmgname..']]'
	end
	
	local xpcell = parse_xp(data.xp, 0)
	local outputval = calc_value(data.outputs, 0, true)
	local inputval = calc_value(data.inputs, 0, false)
	local val = outputval - inputval
	local roi, c_class, c_class_inp
	if val > 0 then
		c_class = 'coins-pos'
	elseif val < 0 then
		c_class = 'coins-neg'
	else
		c_class = 'coins-zero'
	end
	c_class_inp = 'coins-neg'
	if math.abs(inputval) < 0.000001 then
		roi = 'N/A'
		c_class_inp = 'coins-zero'
	else
		roi = string.format("%.1f", 100 * val/inputval) .. "%"
	end
	tr:addClass('mmg-row')
	tr	:tag('td')
			:addClass('mmg-col-name')
			:wikitext(pagename)
		:done()
		:tag('td')
			:attr('data-sort-value', val)
			:addClass('mmg-col-profit')
			:tag('span')
				:addClass('coins')
				:addClass(c_class)
				:wikitext(round1k(val, true))
			:done()
		:done()
		:tag('td')
			:attr('data-sort-value', inputval)
			:addClass('mmg-col-input')
			:tag('span')
				:addClass('coins')
				:addClass(c_class_inp)
				:wikitext(round1k(inputval, true))
			:done()
		:done()
		:tag('td')
			:attr('data-sort-value', outputval)
			:addClass('mmg-col-output')
			:tag('span')
				:addClass('coins coins-pos')
				:wikitext(round1k(outputval, true))
			:done()
		:done()
		:tag('td')
			:addClass('mmg-col-roi')
			:attr('data-sort-value', roi)
			:tag('span')
				:addClass('coins')
				:addClass(c_class)
				:wikitext(round1dp(roi, true))
			:done()
		:done()
		:tag('td')
			:addClass('mmg-col-time')
			:wikitext(timefunc._m_to_c(tostring(data.time)))
		:done()
		:tag('td')
			:attr('data-sort-value', val*60/data.time)
			:addClass('mmg-col-profit-effective')
			:tag('span')
				:addClass('coins')
				:addClass(c_class)
				:wikitext(round1k(val*60/data.time, true))
			:done()
		:done()
		:tag('td')
			:addClass('mmg-col-time-recurrence')
			:attr('data-sort-value', timefunc._w_to_c(tostring(data.recurrence)))
			:wikitext(timefunc._w_to_c(tostring(data.recurrence)))
		:done()
		:tag('td')
			:addClass('mmg-col-skills')
			:addClass('no-list-style')
			:newline()
			:wikitext(data.skill)
			:newline()
		:done()
		:tag('td')
			:addClass('mmg-col-quests')
			:addClass('no-list-style')
			:newline()
			:wikitext(data.quest)
			:newline()
		:done()
		:tag('td')
			:addClass('mmg-col-items')
			:addClass('no-list-style')
			:newline()
			:wikitext(data.item)
			:newline()
		:done()
		:tag('td')
			:addClass('mmg-col-other')
			:addClass('no-list-style')
			:newline()
			:wikitext(data.other)
			:newline()
		:done()
		:node(xpcell)
		:tag('td')
			:addClass('mmg-col-category')
			:wikitext(data.category)
			:attr('data-mmg-category', tostring(data.category):lower())
		:done()
		:tag('td')
			:addClass('mmg-col-intensity')
			:attr('data-sort-value', INTENSITY_SORT[data.intensity] or INTENSITY_SORT["Default"])
			:wikitext(data.intensity)
		:done()
		:tag('td')
			:addClass('mmg-col-membership')
			:wikitext(MEMBERS_ICON[data.members])
			:attr('data-mmg-membership', tostring(data.members))
		:done()
	return val, tr
end

function p.rec(frame)
	local data = mw.smw.ask({'[[MMG recurring JSON::+]]', '[[:+]]', '[[MMG value::+]]', '?MMG recurring JSON', '?=#', limit=10000})
	
	local t = mw.html.create('table')
	
	t	:addClass('wikitable sortable sticky-header mmg-table mmg-table-rec mmg-hidecol-input mmg-hidecol-output mmg-hidecol-quests mmg-hidecol-items mmg-hidecol-other mmg-hidecol-xp')
		:tag('caption')
			:wikitext('[[Money making guide|All guides]] &bull; [[Money making guide/Collecting|Collecting]] &bull; [[Money making guide/Combat|Combat]] &bull; [[Money making guide/Processing|Processing]] &bull; [[Money making guide/Skilling|Skilling]] &bull; [[Money making guide/Recurring|Recurring]]')
		:done()
		:tag('tr')
			:tag('th')
				:addClass('mmg-col-name')
				:wikitext('Method')
			:done()
			:tag('th')
				:addClass('mmg-col-profit')
				:wikitext('Profit')
			:done()
			:tag('th')
				:addClass('mmg-col-input')
				:wikitext('Input value')
			:done()
			:tag('th')
				:addClass('mmg-col-output')
				:wikitext('Output value')
			:done()
			:tag('th')
				:addClass('mmg-col-roi')
				:wikitext('[[wikipedia:Return on investment|ROI]]')
			:done()
			:tag('th')
				:addClass('mmg-col-time')
				:wikitext('Time')
			:done()
			:tag('th')
				:addClass('mmg-col-profit-effective')
				:wikitext('Effective<br>profit')
			:done()
			:tag('th')
				:addClass('mmg-col-time-recurrence')
				:wikitext('Recurrence<br>time')
			:done()
			:tag('th')
				:addClass('mmg-col-skills')
				:wikitext('Skills requirement')
			:done()
			:tag('th')
				:addClass('mmg-col-quests')
				:wikitext('Quests required')
			:done()
			:tag('th')
				:addClass('mmg-col-items')
				:wikitext('Items required')
			:done()
			:tag('th')
				:addClass('mmg-col-other')
				:wikitext('Other requirements')
			:done()
			:tag('th')
				:addClass('mmg-col-xp')
				:wikitext('Experience')
			:done()
			:tag('th')
				:addClass('mmg-col-intensity')
				:wikitext('Intensity')
				:css('width', '65px')
			:done()
			:tag('th')
				:addClass('mmg-col-category')
				:wikitext('Category')
			:done()
			:tag('th')
				:addClass('mmg-col-membership')
				:wikitext('Members')
				:css('width', '65px')
			:done()
			
	local methods = {}
	for i,v in ipairs(data) do
		if type(v['MMG recurring JSON']) == 'table' then
			for j,u in ipairs(v['MMG recurring JSON']) do
				table.insert(methods, { make_rec_row(v[1], u, true) })
			end
		else
			table.insert(methods, { make_rec_row(v[1], v['MMG recurring JSON'], false) })
		end
	end
	table.sort(methods, function(a,b) return a[1]>b[1] end)
	for i,v in ipairs(methods) do
		if v[1] > 0 then
			t:newline():node(v[2])
		end
	end
	t:newline()
	return t
end



return p
-- </nowiki>