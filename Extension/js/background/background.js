//* Extension installed/updated
chrome.runtime.onInstalled.addListener(function(details) {
	//* Update language strings
	updateLanguages();

	switch (details.reason) {
		case 'update':
			//* Load last saved version string
			chrome.storage.local.get('lastVersion', function(result) {
				//* Check if it is a new version or not
				if (result.lastVersion != details.previousVersion) {
					//* Save new version to prevent errors
					chrome.storage.local.set({ lastVersion: details.previousVersion });
					//TODO Open updated tab & settings init
				}
			});
			break;
		case 'install':
			//* Create Options
			//TODO Open installed tab & settings init
			break;
	}
});

var priorityTab,
	lastTab,
	tabPriorityLock = 0;
function tabPriority() {
	//* Get all active tabs
	chrome.tabs.query({ active: true }, function(tabs) {
		//* Load all presences
		chrome.storage.local.get([ 'presences' ], function(result) {
			if (!result.presences) return;

			//* Keep only enabled ones
			var presences = result.presences.filter((f) => f.enabled);
			//TODO clear array if PreMiD == disabled
			//* If there are any proceed
			if (presences.length > 0) {
				//* If priorityTab == current tab reset priorityLock
				if (priorityTab != tabs[0].id) {
					//* If tab change reset tabPriorityLock
					if (lastTab != tabs[0].id) {
						tabPriorityLock = 0;
						lastTab = tabs[0].id;
					}

					//* Loop through presences
					for (var i = 0; presences.length > i; i++) {
						//* active tab url contains presence url
						if (getHost(tabs[0].url).indexOf(getHost(presences[i].url)) > -1) {
							//* Update priorityTab when 5 seconds passed else increase count
							if (tabPriorityLock >= 4) {
								//* Send tab message to stop its intervals
								if (priorityTab) chrome.tabs.sendMessage(priorityTab, { tabPriority: false });

								priorityTab = tabs[0].id;
							} else tabPriorityLock++;
						}
					}
				} else tabPriorityLock = 0;
			}
		});
	});

	if (priorityTab) {
		//* Tell tab to enable intervals
		chrome.tabs.sendMessage(priorityTab, { tabPriority: true });
	}
}

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
	if (changeInfo.status == 'complete') {
		chrome.storage.local.get('presences', function(data) {
			var presences = data.presences;
			if (!presences) return;

			//* Only keep enabled ones
			presences = presences.filter((f) => f.enabled);

			//* Only keep presence that we need for url
			presences = presences.filter((f) => getHost(tab.url) == f.url);

			if (presences.length == 0) return;

			var presence = presences[0];

			chrome.tabs.executeScript(tabId, { code: `try{PreMiD_Presence}catch(e){false}` }, function(result) {
				if (result[0]) return;
				injectPresence(tabId, presence);
			});
		});
	}
});

function getHost(url) {
	var hostname;

	//* Remove protocol if there is one
	if (url.indexOf('//') > -1) {
		hostname = url.split('/')[2];
	} else {
		hostname = url.split('/')[0];
	}

	//* Remove port
	hostname = hostname.split(':')[0];
	//* Remove query string
	hostname = hostname.split('?')[0];

	return hostname;
}

async function injectPresence(tabId, presence) {
	if (presence.hasOwnProperty('tmp')) {
		chrome.tabs.executeScript(tabId, {
			file: '/presenceDev/presence.js'
		});
		if (presence.hasOwnProperty('iframe')) {
			chrome.tabs.executeScript(tabId, {
				file: '/presenceDev/iframe.js',
				allFrames: true
			});
		}
	} else {
		chrome.tabs.executeScript(tabId, {
			code: await fetch(`${presence.source}presence.js`).then(async (res) => res.text())
		});
		if (presence.hasOwnProperty('iframe')) {
			chrome.tabs.executeScript(tabId, {
				code: await fetch(`${presence.source}iframe.js`).then(async (res) => res.text()),
				allFrames: true
			});
		}
	}

	PMD_info(`${presence.service} injected.`);
}

//* Forward the presence data received from Presence script to application
chrome.runtime.onMessage.addListener(function(data, sender) {
	if (data.presence != undefined) {
		PMD_info('Sending Presence Data to Application');
		socket.emit('updateData', data.presence);
	}

	if (data.iframe_video != undefined && priorityTab != null) {
		PMD_info('Sending iFrame video data to presence');
		chrome.tabs.sendMessage(priorityTab, data);
	}
});