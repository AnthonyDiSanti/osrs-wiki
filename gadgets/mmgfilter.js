'use strict';
/* global $, mw, OO */
if (document.querySelector('.mmg-filter-form-container')) {
	const DATA_cat_dropdown = {
		txt: 'Categories', title: 'Show or hide various types of methods based on what you do', class: 'category-select', label: 'Filters',
		items: [
			{ val: 'combathigh', txt: 'High-level combat', title: 'Combat based methods that require high-level gear and skills' },
			{ val: 'combatmid', txt: 'Mid-level combat', title: 'Combat based methods that require mid-level gear and skills' },
			{ val: 'combatlow', txt: 'Low-level combat', title: 'Combat based methods that require low-level gear and skills' },
			{ val: 'gathering', txt: 'Gathering', title: 'Using skills to gather items, with little or no input items' },
			{ val: 'processing', txt: 'Processing', title: 'Buying items and turning them into other items' },
			{ val: 'collecting', txt: 'Collecting', title: 'Basic methods that involve picking up things or buying from shops - unskilled labour' },
		]
	},
	DATA_quest_radios = {
		txt: 'Quest requirements', title: 'Whether to filter methods based on your quest completions', name: 'mmg-filter-quest-radios', class: 'quest-radios', label: '&nbsp;',
		items: [
			{ val: 'quest-none', txt: 'Do not hide guides based on my quest completion', title: 'Methods will not be hidden based on your quest completion status' },
			{ val: 'quest-required', txt: 'Hide guides where I have not completed the required quests', title: 'Methods which require quests that you have not completed will be hidden' },
			{ val: 'quest-recommended', txt: 'Hide guides where I have not completed the required <strong>and recommended</strong> quests', title: 'Methods which require or recommend quests that you have not completed will be hidden' },
		]
	},
	DATA_level_radios = {
		txt: 'Level requirements', title: 'Whether to filter methods based on your skill levels', name: 'mmg-filter-level-radios', class: 'level-radios', label: '&nbsp;',
		items: [
			{ val: 'level-none', txt: 'Do not hide guides based on my skill levels', title: 'Methods will not be hidden based on your current skill levels' },
			{ val: 'level-required', txt: 'Hide guides where I do not meet the required levels', title: 'Methods which require levels that you do not have will be hidden' },
			{ val: 'level-recommended', txt: 'Hide guides where I do not meet the required <strong>and recommended</strong> levels', title: 'Methods which require or recommend levels that you do not have will be hidden' },
		]
	},
	DATA_col_select = {
		txt: '', title: 'Change which columns are visible in the table', class: 'column-select', addClass: 'oo-ui-icon-settings', label: false,
		items: [
			{ val: 'roi', txt: 'Return on investment' },
			{ val: 'input', txt: 'Input value' },
			{ val: 'output', txt: 'Output value' },
			{ val: 'xp', txt: 'Experience' },
			{ val: 'skills', txt: 'Skill level requirements' },
			{ val: 'quests', txt: 'Quest requirements' },
			{ val: 'items', txt: 'Item requirements' },
			{ val: 'other', txt: 'Other requirements' },
			{ val: 'category', txt: 'Category' },
			{ val: 'intensity', txt: 'Intensity' },
			{ val: 'membership', txt: 'Membership' }
		]
	},
	QUEST_CORRECTIONS = {
		// first value is RuneMetrics name, second is correct (wiki) name without the (quest) suffix
		'Finale': 'Once Upon a Time in Gielinor: Finale',
		'Flashback': 'Once Upon a Time in Gielinor: Flashback',
		'Foreshadowing': 'Once Upon a Time in Gielinor: Foreshadowing',
		'Fortunes': 'Once Upon a Time in Gielinor: Fortunes',
		'Father and Son': 'Father and Son (miniquest)',
		'Helping Laniakea': 'Helping Laniakea (miniquest)'
	},
	SKILLNAMES = [
		"attack", "defence", "strength", "constitution", "ranged", "prayer",
		"magic", "cooking", "woodcutting", "fletching", "fishing", "firemaking",
		"crafting", "smithing", "mining", "herblore", "agility", "thieving", "slayer",
		"farming", "runecrafting", "hunter", "construction", "summoning",
		"dungeoneering", "divination", "invention", "archaeology", "necromancy"
	],
	categories_groups = {
		'combatlow': ['combat/low', 'combat'],
		'combatmid': ['combat/mid', 'combat'],
		'combathigh': ['combat/high', 'combat', 'combat/boss'],
		'collecting': ['collecting'],
		'gathering': ['gathering'],
		'processing': ['processing']
	},
	defaultSettings = {
		skills: 'level-none',
		quests: 'quest-none',
		upfront: '',
		profit: '',
		category: DATA_cat_dropdown.items.map((e)=>e.val),
		p2p: 'p2p',
		columns: ['roi', 'skills', 'category', 'intensity', 'membership']
	};

	let settings = {}, rsn = '', playerStats = { quests: {}, skills: {} }, allowedCategories = [], helppopup=null;
	window.MMG_DEBUG = mw.config.get('debug') > 0;

	const has_content = (x) => {
		return !(x==='' || x===null || x===undefined);
	};

	const loadLocalStorage = () => {
		if (window.rs.hasLocalStorage()) {
			rsn = window.localStorage.getItem('rsn');
			try {
				settings = $.extend({}, defaultSettings, JSON.parse(window.localStorage.getItem('mmg-filter-settings')));
				return;
			} catch (e) { }
		}
		settings = $.extend({}, defaultSettings);
	};

	const saveLocalStorage = () => {
		if (window.rs.hasLocalStorage()) {
			if (has_content(rsn)) {
				window.localStorage.setItem('rsn', rsn);
			}
			window.localStorage.setItem('mmg-filter-settings', JSON.stringify(settings));
		}
	};

	const setHsStatus = (msg, type) => {
		mw.notify(msg, {type:type, title:'Hiscore Lookup', tag:'mmg-filter-notif'});
	};

	const lookupStats = (e) => {
		syncVal(e);
		let username = $('#mmg-filter-form-0 .mmg-filter-hs input').val().trim();
		if (username === '') {
			setHsStatus('Invalid username (empty)', 'error');
			return;
		}
		setHsStatus('Loading skill levels..', 'info');
		playerStats = { quests: {}, skills: {} };
		fetch('/cors/m=runemetrics/profile/profile?user=' + username).then((x) => { if (x.ok) return x.json(); throw 'Request failed: ' + x.status }).then((x) => {
			if (x.error) {
				setHsStatus('Failed to get levels: is your RuneMetrics set to private?', 'error');
				return;
			}
			for (let s of x.skillvalues) {
				if (s.xp > -1) {
					playerStats.skills[SKILLNAMES[s.id]] = { level: s.level, xp: s.xp };
				}
			}
			playerStats.skills.combat = {level: x.combatlevel, xp: 0};//xp irrelevant
			setHsStatus('Loaded skills, now loading quests...', 'info');
			fetch('/cors/m=runemetrics/quests?user=' + username).then((x) => { if (x.ok) return x.json(); throw 'Request failed: ' + x.status }).then((x) => {
				for (let q of x.quests) {
					let qstatus = '';
					if (q.status == 'COMPLETED') {
						qstatus = 'completed';
					} else if (q.status == 'NOT_STARTED') {
						if (q.userEligible) {
							qstatus = 'eligible';
						} else {
							qstatus = 'noteligible';
						}
					} else {
						qstatus = 'inprogress';
					}
					playerStats.quests[q.title] = qstatus;
				}
				setHsStatus('Loaded skills and quests for ' + username + '!', 'success');
				filterTable();
			}).catch((x) => {
				setHsStatus('Error fetching stats: ' + x, 'error');
			});
		}).catch((x) => {
			setHsStatus('Error fetching stats: ' + x, 'error');
		});
		rsn = username;
		saveLocalStorage();
	};

	const checkReq = ($req, is_sub) => { //return TRUE if the requirement is met and FALSE if not
		let data = $req.data();
		// remove met flag
		$req.removeClass('mmg-req-met');
		let parent_imp = null;
		if (is_sub) {
			parent_imp = $req.parents('td', '.mmg-req-or').first().data('mmgImp');
		}
		if ($req.hasClass('mmg-req-or')) {
			// this is an or-req
			let ret = false;
			for (let subreq of $req.find('.mmg-req').filter((i, e) => $(e).parentsUntil($req, '.mmg-req').length == 0)) {
				// iterate through direct subreqs
				ret |= checkReq($(subreq), true);
				if (ret) break; //or with ret and break if true
			}
			if (ret) $req.addClass('mmg-req-met');
			return ret;
		} else if ($req.hasClass('mmg-quest')) {
			if (settings.quests === 'quest-none') {return true;}
			let questname = data.mmgQuest, imp = data.mmgImp, allowedImps = ['', 'required']; //somtimes required is ''
			if (settings.quests === 'quest-recommended') allowedImps.push('recommended');
			if (allowedImps.includes(data.mmgImp) || (!has_content(data.mmgImp) && is_sub && allowedImps.includes(parent_imp))) {
				if (playerStats.quests[questname] == 'completed') {
					$req.addClass('mmg-req-met');
					return true;
				}
			} else {
				$req.addClass('mmg-req-met');
				return true;
			}
			return false;
		} else if ($req.hasClass('mmg-skill')) {
			if (settings.skills === 'level-none') {return true;}
			if (playerStats.skills[data.mmgSkill] === undefined) return true;
			let allowedImps = ['', 'required']; //somtimes required is ''
			if (settings.skills === 'level-recommended') allowedImps.push('recommended');
			if (allowedImps.includes(data.mmgImp) || (!has_content(data.mmgImp) && is_sub && allowedImps.includes(parent_imp))) {
				if  (playerStats.skills[data.mmgSkill].level >= data.mmgLevel) {
					$req.addClass('mmg-req-met');
					return true;
				}
			} else {
				$req.addClass('mmg-req-met');
				return true;
			}
			return false;
		}

		return null;
	};

	const log = (...args) => {
		if (window.MMG_DEBUG) console.log(...args);
	};

	const onlyOuterMmgreqs = (i, e) => $(e).parents('.mmg-req').length === 0; //filter function for jQuery filter method; only fetches mmg-reqs that are the outermost; i.e. removes the contents of mmg-req-or
	const filterRow = ($row) => { //returns TRUE to show the row and FALSE to hide it
		// TEMP
		// if no mmgreqs used, hide it
		// just for the alpha period of this filter
		/*if ($row.find('.mmg-req').length === 0) {
			//log($row, 'FILTERED: noreqs');
			return false;
		}*/
		// TEMP

		if (settings.p2p === 'f2p') {
			if ($row.find('.mmg-col-membership').data('mmgMembership')) {
				//log($row, 'FILTERED: notmembers');
				return false;
			}
		}
		if (settings.upfront !== '') {
			if ($row.find('.mmg-col-input').data('sortValue') > settings.upfront) {
				//log($row, 'FILTERED: upfront');
				return false;
			}
		}
		if (settings.profit !== '') {
			if ($row.find('.mmg-col-profit').data('sortValue') < settings.profit) {
				//log($row, 'FILTERED: upfront');
				return false;
			}
		}
		if (!allowedCategories.includes($row.find('.mmg-col-category').data('mmgCategory'))) {
			//log($row, 'FILTERED: category');
			return false;
		}
		let $reqs = $row.find('.mmg-req').filter(onlyOuterMmgreqs);
		for (let req of $reqs) {
			let reqIsMet = checkReq($(req), false); // can be true, false, null
			if (reqIsMet === false) {
				//log($row, 'FILTERED: req', req);
				return false;
			}
		}
		//log($row, 'NOTFILTERED');
		return true;
	};
	//sync value set in one element to the other filters on the page
	const syncVal = (event) => {
		if (event === null || event === undefined) return;
		let $e = $(event.target);
		let newVal = [$e.val()]; //array will set each matched element to respective array value
		if ($e.is(':checkbox, :radio')) {
			// notably for checks/radios it will set select checkboxes that have one of the values in the array, and unselect those that are not present
			if (!$e.is(':checked')) {
				// so we use empty array if its not checked
				newVal = [];
			}
		}
		let id = $e.attr('id');
		let id_substr = id.substring(0, id.lastIndexOf('-'));
		$(`${event.target.tagName}[id^="${id_substr}"]`).not($e).each((i,e)=>$(e).val(newVal));
		//.val does not trigger .change events
	};

	const getSelectedRadio = (container) => {
		return $(container).find('input:checked').val();
	};
	const getSelectedCheckboxes = (container) => {
		let out = [];
		$(container).find('input:checked').each((i, e) => { out.push($(e).val()) });
		return out;
	};

	// add a tiny timeout to make sure events have bubbled and value changes have been applied to the fields
	const filterTable = (e) => {
		setTimeout(_filterTable, 20, e);
	};
	const _filterTable = (e) => {
		log('filter triggered');
		syncVal(e);

		settings = {
			skills: getSelectedRadio('#mmg-filter-form-0 .mmg-filter-dropdown-level-radios'),
			quests: getSelectedRadio('#mmg-filter-form-0 .mmg-filter-dropdown-quest-radios'),
			upfront: $('#mmg-filter-form-0 .mmg-filter-gp input').val(),
			profit: $('#mmg-filter-form-0 .mmg-filter-profit input').val(),
			category: getSelectedCheckboxes('#mmg-filter-form-0 .mmg-filter-dropdown-category-select'),
			p2p: getSelectedRadio('#mmg-filter-form-0 .mmg-filter-p2p'),
			columns: getSelectedCheckboxes('#mmg-filter-dropdown-column-select-0')
		};
		try{
			settings.upfront = parseFloat(settings.upfront);
			if (isNaN(settings.upfront) || settings.upfront === undefined || settings.upfront === null) {
				settings.upfront = '';
			}
		} catch(e) {
			settings.upfront = '';
		}
		if (settings.upfront === 0) {
			settings.upfront = '';
		}
		try{
			settings.profit = parseFloat(settings.profit);
			if (isNaN(settings.profit) || settings.profit === undefined || settings.profit === null) {
				settings.profit = '';
			}
		} catch(e) {
			settings.profit = '';
		}
		if (settings.profit === 0) {
			settings.profit = '';
		}
		allowedCategories = [];
		settings.category.forEach(e=>{
			allowedCategories = allowedCategories.concat(categories_groups[e]);
		});
		log('mmgfilter settings', settings);
		log('mmgfilter allowed categories', allowedCategories);
		for (let row of $('.mmg-table .mmg-row')) {
			let $row = $(row);
			let showRow = filterRow($row);
			if (showRow) {
				$row.addClass('mmg-row-show').removeClass('mmg-row-hide');
			} else {
				$row.addClass('mmg-row-hide').removeClass('mmg-row-show');
			}
		}
		$('.mmg-table').each((i,e)=>{
			let $e = $(e);
			let total = $e.find('.mmg-row').length;
			let hidden = $e.find('.mmg-row.mmg-row-hide').length;
			$e.find('caption').remove();
			$e.prepend(`<caption>Showing ${total-hidden} of ${total} guides</caption>`);
		});
		_toggleColumns();
		saveLocalStorage();
	};

	const toggleColumns = (e) => {
		setTimeout(_toggleColumns, 20, e);
	};
	const _toggleColumns = (e) => {
		syncVal(e);
		settings.columns = getSelectedCheckboxes('#mmg-filter-dropdown-column-select-0');
		let addClasses = [], removeClasses = [];
		for (let c of DATA_col_select.items) {
			if (settings.columns.includes(c.val)) {
				removeClasses.push(`mmg-hidecol-${c.val}`);
			} else {
				addClasses.push(`mmg-hidecol-${c.val}`);
			}
			$('.mmg-table').addClass(addClasses).removeClass(removeClasses);
		}
		saveLocalStorage();
	};

	const showHelp = () => {
		//$('.mmg-filter-help').addClass('mmg-filter-help-loading');
		$('.mmg-filter-help button').prop('disabled', true);
		window.rswiki.withOOUIWindowManager().then(manager => {
			if (manager.hasWindow('mmg-filter-help-window')) {
				manager.openWindow('mmg-filter-help-window');
			} else {
				window.rswiki.createOOUIWindow('mmg-filter-help-window', 'Money Making Guide Filter Help', { size: 'large' }, (dia) => {
					helppopup = dia;
					dia.content = new OO.ui.PanelLayout({ padded: true, expanded: false, classes: ['mmg-filter-help-window-panel'] });
					let cat_str = [];
					for (let c of DATA_cat_dropdown.items) {
						cat_str.push(`<li><strong>${c.txt}</strong>: ${c.title}</li>`);
					}
					cat_str = cat_str.join('');
					dia.content.$element.append(
						'<h2>Money Making Guide Filter Help</h2>',
						'<p>The money making guide filters are designed to help you find guides that are relevant to your skills, quests, and preferences. To get started, toggle some of the fields here. Here is a description of each:</p>',
						$('<ul>').append(
							'<li><strong>Hiscores lookup</strong>: Enter your in-game name to lookup your skill levels and quest completion status. Requires your <a href="/w/RuneMetrics" target="_blank">RuneMetrics</a> profile to be public.</li>',
							'<li><strong>Free-to-play status</strong>: Toggle whether the table shows all methods, or only methods that can be done by free-to-play players.</li>',
							`<li><strong>Category filter</strong>: Select which types of methods to be shown:<ul>${cat_str}</ul></li>`,
							'<li><strong>Level requirements</strong> and <strong>Quest requirements</strong>: Select whether you want to remove guides where you do not meet the requirements, or the requirements and recommendations, or neither, for skill levels and quests respectively.</li>',
							'<li><strong>Min profit per hour</strong>: Enter a number here to hide methods that have a lower profit per hour. Set to 0 or empty to disable.</li>',
							'<li><strong>Max GP required per hour</strong>: Enter a number here to limit the maximum amount of GP required per hour (to buy items needed). Does not include GP needed for one-off purchases (like equipment). Set to 0 or empty to disable.</li>',
							'<li><strong>Visible columns (cog in table header)</strong>: Toggle which columns are visible.</li>'
						),
						'<p>If you need further help, feel free to ask in our <a href="https://discord.gg/wB3YBttakC" target="_blank">Discord server - check out the <code>#mmg-improvements</code> channel</a>.</p>'
					);
					dia.$element.on('click', function (e) {
						if (e.target !== this) return;
						window.OOUIWindowManager.closeWindow( 'mmg-filter-help-window' );
					})
					const closeButton = new OO.ui.ButtonWidget({ label: 'Dismiss' });
					closeButton.on('click', () => window.OOUIWindowManager.closeWindow( 'mmg-filter-help-window' ));
					dia.content.$element.append(closeButton.$element);
					dia.$body.append(dia.content.$element);
				}, true, true, false);
			}
		}).then(()=>{
			//$('.mmg-filter-help').removeClass('mmg-filter-help-loading');
			$('.mmg-filter-help button').prop('disabled', false);
		});
	};
	const init = () => {
		const numbers_regex = /^[\d\.eE]$/; // allow any digit, ., and e (allow for example 5e6 for 5m)
		const prevent_non_numbers_in_input = (e) => {
			if (e.type === 'keydown') {
				if (!(e.key === undefined || e.key.length !== 1 || numbers_regex.test(e.key))) {
					// fix for firefox bug where text can be entered in number inputs
					e.preventDefault();
					e.stopImmediatePropagation();
					e.stopPropagation();
					return;
				}
			}
			filterTable();
		};
		const close_dropdown_on_click = (e) => {
			let $targ = $(e.target);
			log('htmlclick', e, $targ.hasClass('mmg-filter-dropdown-menu'), $targ.parents('.mmg-filter-dropdown-menu'), $targ.hasClass('mmg-filter-dropdown-button'));
			if ($targ.hasClass('mmg-filter-dropdown-menu') || $targ.parents('.mmg-filter-dropdown-menu').length > 0) {
				e.stopPropagation();
			} else if (!$targ.hasClass('mmg-filter-dropdown-button')) {
				$('.mmg-filter-dropdown').addClass('mmg-filter-dropdown-hidden');
				$('html').off('click', close_dropdown_on_click);
				e.stopPropagation();
			}
		};
		const open_dropdown_button = (e) => {
			let $parent = $(e.target).parents('.mmg-filter-dropdown');
			log('buttonclick', e, $parent);
			let is_hidden = $parent.hasClass('mmg-filter-dropdown-hidden');
			$('.mmg-filter-dropdown').addClass('mmg-filter-dropdown-hidden'); //add to all dropdowns
			$parent.toggleClass('mmg-filter-dropdown-hidden', !is_hidden);
			$parent.toggleClass('mmg-filter-dropdown-shown', is_hidden);
			$('html').off('click', close_dropdown_on_click);
			if (is_hidden) {
				$('html').on('click', close_dropdown_on_click);
			}
			reposOpenDropdowns();
			e.stopPropagation();
		};
		const makeDropdown = (data, type, index) => {
			let $out = $(`<div class="mmg-filter-dropdown mmg-filter-dropdown-hidden mmg-filter-dropdown-${data.class}" id="mmg-filter-dropdown-${data.class}-${index}">`);
			let $ul = $('<ul class="mmg-filter-dropdown-menu">');
			let $button = $(`<button class="mmg-filter-dropdown-button" title="${data.title}">${data.txt}</button>`);
			if (data.addClass !== undefined) {
				$button.addClass(data.addClass);
			}
			if (data.label) {
				$out.append(`<span class="mmg-filter-label">${data.label}<span>`, $('<div class="mmg-filter-dropdown-field">').append($button, $ul));
			} else {
				$out.append($button, $ul);
			}
			$button.on('click', open_dropdown_button);
			let typestr = `type="${type}"`;
			if (data.name !== undefined) {
				typestr += ` name="${data.name}-${index}"`;
			}
			data.items.forEach(item => {
				$ul.append(`<li><div class="mmg-filter-dropdown-item" title="${item.title === undefined ? item.txt : item.title}"><label for="mmg-filter-check-${item.val}-${index}"><input value="${item.val}" id="mmg-filter-check-${item.val}-${index}" ${typestr}>${item.txt}</label></div></li>`);
			});
			return $out;
		};
		const reposOpenDropdowns = () => {
			// adjusts the position of the dropdown so that labels don't wrap lines
			$('.mmg-filter-form-container .mmg-filter-dropdown.mmg-filter-dropdown-shown').each((i, e)=>{
				let $e = $(e);
				let $menu = $e.find('.mmg-filter-dropdown-menu');
				$menu.css('left', 'auto');
				let adjustment = 0;
				$menu.find('label').each((i1,e1)=>{
					let r = e1.getClientRects();
					let a = 0;
					for (let i2 = 1; i2<r.length; i2++) { //skip the first rect, that's the first line6
						a += r[i2].width;
					}
					adjustment = Math.max(adjustment, a);
				});
				if (adjustment > 0) {
					let pos = $(e).find('button').position();
					let newpos = Math.max(0, pos.left - adjustment*1.05); //give it a little extra space but don't go more left than 0
					$menu.css('left', newpos+'px');
				}
			});
		};

		const makeForm = (index, element) => {
			const form = $(`<div class="mmg-filter-form" id="mmg-filter-form-${index}">`),
				hs_name = $(`<input type="text" placeholder="Username" id="mmg-filter-hs-name-${index}" title="Input your RuneScape name here to lookup your skill levels and quests.">`),
				hs_button = $(`<button id="mmg-filter-hs-button-${index}">Lookup</button>`),
				p2p_toggles = $(`<div class="mmg-filter-p2p" title="Toggle whether members-only methods are shown."><span class="mmg-filter-label">Free-to-play status</span><div class="mmg-filter-togglebuttons"><div class="mmg-filter-togglebutton mmg-filter-togglebutton-p2p"><input type="radio" name="mmg-filter-p2p-${index}" id="mmg-filter-p2p-p2p-${index}" value="p2p"><label for="mmg-filter-p2p-p2p-${index}" class="mmg-filter-togglebutton-label">Show all</label></div><div class="mmg-filter-togglebutton mmg-filter-togglebutton-f2p"><input type="radio" value="f2p" name="mmg-filter-p2p-${index}" id="mmg-filter-p2p-f2p-${index}"><label for="mmg-filter-p2p-f2p-${index}" class="mmg-filter-togglebutton-label">Show only F2P</label></div></div>`),
				cat_dropdown = makeDropdown(DATA_cat_dropdown, 'checkbox', index),
				level_dropdown = makeDropdown(DATA_level_radios, 'radio', index),
				quest_dropdown = makeDropdown(DATA_quest_radios, 'radio', index),
				gp_upfront = $(`<div class="mmg-filter-gp"><label for="mmg-filter-gp-${index}">Max. GP required per hour</label><input type="number" placeholder="GP" id="mmg-filter-gp-${index}"></div>`),
				gp_profit = $(`<div class="mmg-filter-profit"><label for="mmg-filter-profit-${index}">Min. profit per hour</label><input type="number" placeholder="GP" id="mmg-filter-profit-${index}"></div>`),
				column_selector = makeDropdown(DATA_col_select, 'checkbox', index),
				help_button = $('<div class="mmg-filter-help"><span class="mmg-filter-title">Filters</span><button class="oo-ui-icon-helpNotice"></button></div>'),
				$container = $(element);
				
			// set initial values from localStorage or default
			if (has_content(rsn)) {
				hs_name.val(rsn);
			}
			p2p_toggles.find(`input[value="${settings.p2p}"]`).prop('checked', true);
			cat_dropdown.find('input[type="checkbox"]').val(settings.category); //$('input[type="checkbox"]').val([a,b,c]) => sets checked on checkboxes with value a,b,c and unchecked on others
			column_selector.find('input[type="checkbox"]').val(settings.columns);
			quest_dropdown.find(`input[value="${settings.quests}"]`).prop('checked', true);
			level_dropdown.find(`input[value="${settings.skills}"]`).prop('checked', true);
			gp_upfront.find('input').val(settings.upfront);
			gp_profit.find('input').val(settings.profit);
			
			// add to page
			form.append(help_button, $('<div class="mmg-filter-field mmg-filter-hs">').append(`<label for="mmg-filter-hs-name-${index}">Hiscore Lookup</label>`, hs_name, hs_button), p2p_toggles, cat_dropdown, level_dropdown, quest_dropdown, gp_profit, gp_upfront);
			
			let $adjMmgTable = $container.parent().find('> table.mmg-table');
			$container.empty().append(form);
			
			// column selector added to header of adjacent table
			$adjMmgTable.find('th.mmg-col-name').first().prepend(column_selector);
			// prevent clicking on the column selector from sorting the table instead
			column_selector.on('click', e=>{
				if ($(e.target).parents('.mmg-filter-dropdown').length>0) {
					e.stopPropagation();
				}
			});
			
			// attach help button event
			help_button.find('>button').on('click', showHelp);

			// attach events to form elements
			hs_name.on('enter', lookupStats);
			hs_button.on('click', lookupStats);
			p2p_toggles.find('input').on('change', filterTable);
			cat_dropdown.find('input').on('change', filterTable);
			level_dropdown.find('input').on('change', filterTable);
			quest_dropdown.find('input').on('change', filterTable);
			gp_upfront.find('input').on('change enter keydown', prevent_non_numbers_in_input);
			gp_profit.find('input').on('change enter keydown', prevent_non_numbers_in_input);
			column_selector.find('input').on('change', filterTable);
		};
		
		log('init');
		loadLocalStorage();
		$('.mmg-filter-form-container').each(makeForm);
		$('.mmg-table caption').remove();
		$(window).on('resize', () => {
			$('.mmg-filter-form-container').each((i, e) => $(e).height($(e).find('.mmg-filter-form').height()));
			reposOpenDropdowns();
		});
		$(window).trigger('resize');
		filterTable();
		if (has_content(rsn)) {
			lookupStats();
		}
	};

	const init2 = () => {
		log('init2');
		if (document.querySelector('.mmg-filter-form-container')) {
			init();
		}
	};

	$(init2);
}