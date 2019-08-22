'use strict'
const test = require('tape')
const addons = require('../index.js')
const path = require('path')
const portals = require('../lib/sources')
const addonRoot = path.join(__dirname, 'mock')
const addonManager = addons(addonRoot)

const portal = portals['curse']

test('get categories', t => {
  t.plan(3)
  portal.getCategories((err, categories) => {
    t.error(err, ' get category worked')
    t.ok(categories.length > 0, ' alteast one category returned')
    t.equals(categories.length, 29)
  })
})

test('get addons in category', t => {
  t.plan(2)
  const category = {
    "name": 'Chat & Communication',
    "link": 'https://www.curseforge.com/wow/addons/chat-communication',
    "subCategories": [],
    "portal": 'curse'
  };

  portal.getAddonsFromCategory(category, (errAddons, addons) => {
    t.error(errAddons, ' failed to get addons from category')
    t.ok(addons.length > 0, ' alteast one addon returned')
  })
})

test('get info about addon', t => {
  t.plan(3)
  const addonFromCategory = {
    "name": "Raider.IO Mythic Plus and Raid Progress",
    "link": "https://www.curseforge.com/wow/addons/raiderio",
    "creator": "",
    "image": "",
    "downloads": 55100000,
    "category": "Chat & Communication",
    "portal": "curse"
  }

  portal.getAddonInfo(addonFromCategory, (err, info) => {
    t.error(err, ' getting addon worked')
    t.ok(info.downloadLink.startsWith('https://www.curseforge.com/wow/addons/raiderio/download/'))
    t.equals(info.portal, 'curse')
  })
})

test('install and uninstall addon', t => {
  t.plan(2)
  const addonInfo = {
    "name": 'Raider.IO Mythic Plus and Raid Progress',
    "version": 'v201908220600',
    "link": 'https://www.curseforge.com/wow/addons/raiderio',
    "downloadLink": 'https://www.curseforge.com/wow/addons/raiderio/download/2767288/file',
    "portal": 'curse'
  }

  addonManager.installAddon(addonInfo, (err, folders) => {
    t.error(err, ' installing addons worked')
    addonManager.deleteAddon(addonInfo.name, err => {
      t.error(err, ' delete worked')
    })
  })
})

test('search for addons', t => {
  t.plan(4)

  portal.search('deadly', (err, res) => {
    t.ok(res.length > 0, ' atleast some search results were found')
    t.error(err, ' no error returned from search')
    t.ok(typeof res[0].downloads === 'number' && res[0].downloads > 2000000, ' downloads is a number that is greater than zero')
    t.equals(res[0].name, 'Deadly Boss Mods (DBM)')
  })
})

test('search for addons that doesnt exist', t => {
  t.plan(2)
  portal.search('I-dont-think-this-name-exists', (err, res) => {
    t.error(err, 'searching for none existing worked')
    t.ok(res.length == 0, ' no packages found, good')
  })
})

test('check for updates', t => {
  t.plan(2)

  const addonInfo = {
    "name": 'Bagnon',
    "version": '8.2.0',
    "link": 'https://www.curseforge.com/wow/addons/bagnon',
    "downloadLink": 'https://www.curseforge.com/wow/addons/bagnon/download/2733373/file',
    "portal": 'curse'
  }

  addonManager.installAddon(addonInfo, (err, folders) => {
    addonManager.listAddons(addons => {
      addonManager.checkForAddonUpdate(addons[0], (err, versionInfo) => {
        t.error(err, 'check for update didnt crash. good')
        addonManager.deleteAddon(addonInfo.name, err => {
          t.error(err, ' deleting ' + addonInfo.name + ' worked')
        })
      })
    })
  })
})

test('getting addon version', t => {
  t.plan(2)
  portal.getAddonInfo({
    name: 'Bagnon',
    link: 'https://www.curseforge.com/wow/addons/bagnon',
    portal: 'curse'
  }, (err, info) => {
    t.error(err, 'didnt get an error object');
    t.ok(info.version !== undefined, 'info got a version');
  })
})

test('parse download count', t => {
  t.plan(4)

  t.equals(portal._parseDownloads('123'), 123, 'should be able to parse simple numbers')
  t.equals(portal._parseDownloads('1K'), 1000, 'should be able to parse K')
  t.equals(portal._parseDownloads('1M'), 1000000, 'should be able to parse M')
  t.equals(portal._parseDownloads('1.1M'), 1100000, 'should be able to parse decimal with M')
})