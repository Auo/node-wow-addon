'use strict'
const test = require('tape')
const addons = require('../index.js')
const path = require('path')
const portals = require('../lib/sources')
const addonRoot = path.join(__dirname, 'mock')
const addonManager = addons(addonRoot)

const portal = portals['curse']

test('get categories from curse', t => {
  t.plan(2)
  portal.getCategories((err, categories) => {
    t.error(err, ' get category worked')
    t.ok(categories.length > 0, ' alteast one category returned')
  })
})

test('get category addons from curse', t => {
  t.plan(5)
  portal.getCategories((err, categories) => {
    portal.getAddonsFromCategory(categories[0], (errAddons, addons) => {
      t.error(errAddons, ' failed to get addons from category')
      t.ok(addons.length > 0, ' alteast one addon returned')
      portal.getAddonInfo(addons[0], (err, info) => {
        t.error(err, ' getting addon worked')

        addonManager.installAddon(info, (err, folders) => {
          t.error(err, ' installing addons worked')
          addonManager.deleteAddon(info.name, err => {
            t.error(err, ' delete worked')
          })
        })
      })
    })
  })
})

test('testing search curse', t => {
  t.plan(3)

  portal.search('deadly', (err, res) => {
    t.ok(res.length > 0, ' atleast some search results were found')
    t.error(err, ' no error returned from search')
    t.ok(typeof res[0].downloads === 'number' && res[0].downloads > 2000000, ' downloads is a number that is greater than zero')
  })
})

test('get addon information from curse', t => {
  t.plan(7)

  portal.search('bagnon', (err, res) => {
    t.ok(typeof res[0].downloads === 'number', 'downloads is a number')
    t.error(err, ' searching for addon worked')
    t.ok(res.length > 0, ' atleast one search result')
    portal.getAddonInfo(res[0], (err, info) => {
      t.error(err, ' getting addon worked')
      t.ok(info.version !== null, ' version is defined')

      addonManager.installAddon(info, (err, folders) => {
        t.error(err, ' installing addons worked')
        addonManager.deleteAddon(info.name, err => {
          t.error(err, ' delete worked')
        })
      })
    })
  })
})

test('search for addons that doesnt exist curse', t => {
  t.plan(2)
  portal.search('I-dont-think-this-name-exists', (err, res) => {
    t.error(err, 'searching for none existing worked')
    t.ok(res.length == 0, ' no packages found, good')
  })
})

test('check for updates', t => {
  t.plan(2)

  portal.search('bagnon', (err, res) => {
    portal.getAddonInfo(res[0], (err, info) => {
      addonManager.installAddon(info, (err, folders) => {
        addonManager.listAddons(addons => {
          addonManager.checkForAddonUpdate(addons[0], (err, versionInfo) => {
            t.error(err, 'check for update didnt crash. good')
            addonManager.deleteAddon(info.name, err => {
              t.error(err, ' deleting ' + info.name + ' worked')
            })
          })
        })
      })
    })
  })
})

test('getting version from curse', t => {
  t.plan(2);
  portal.getAddonInfo({
    name: 'Bagnon',
    link: 'https://www.curseforge.com/wow/addons/bagnon',
    portal: 'curse'
  }, (err, info) => {
    t.error(err, 'didnt get an error object');
    t.ok(info.version !== undefined, 'info got a version');
  })
})