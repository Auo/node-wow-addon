'use strict'
const test = require('tape')
const addons = require('../lib/index.js')
const path = require('path')
const portals = require('../lib/sources')
const addonRoot = './test/mock/'
const addonManager = addons(addonRoot)

test('sending null path', t => {
    t.plan(2)
    t.throws(() => addons(null),'installation path is empty or wrong type')
    t.throws(() => addons(), 'installation path is empty or wrong type')
})

test('testing search curse', t => {
  t.plan(2)

  portals['curse'].search('deadly', (err, res) => {
    t.ok(res.length > 0, ' atleast some search results were found')
    t.error(err, ' no error returned from search')
  })
})

test('testing search wowinterface', t => {
  t.plan(2)
  portals['wowinterface'].search('deadly', (err, res) => {
    t.ok(res.length > 0, ' atleast some search results were found')
    t.error(err, ' no error returned from search')
  })
})

test('create dummy addon', t => {
  t.plan(2)
  addonManager.createAddon('dummy', (err, addonPath) => {
    t.error(err,'addon creation success')
    t.equals(addonPath, path.join(addonRoot, 'dummy'))
  })
})

test('get addons from addons.json', t => {
  t.plan(1)
  addonManager.listAddons(addons => {
    t.ok(addons.length >= 1,'atleast one addon found' )
  })
})

test('delete addon', t => {
  t.plan(1)
  addonManager.deleteAddon('dummy', err => {
    t.error(err, 'deleting addon success')
  })
})

test('get addon information from curse', t => {
  t.plan(6)

  portals['curse'].search('bagnon', (err, res) => {
    t.error(err, ' searching for addone worked')
    t.ok(res.length > 0, ' atleast one search result')
    portals['curse'].getAddonInfo(res[0], (err, info) => {
      t.error(err, ' getting addon worked')
      t.ok(info.version !== null, ' version is defined')
      t.ok(info.downloadLink.indexOf('.zip') !== -1, ' download link has .zip file')
      addonManager.installAddon(info, (err, folders) => {
        t.error(err, ' installing addons worked')
      })
    })
  })
})

test('get addon information from wowinterface', t => {
  t.plan(7)
  portals['wowinterface'].search('bagnon', (err, res) => {
    t.error(err, ' searching for addone worked')
    t.ok(res.length > 0, ' atleast one search result')
    portals['wowinterface'].getAddonInfo(res[0], (err, info) => {
      t.error(err, ' getting addon worked')
      t.ok(info.version !== null, ' version is defined')
      t.ok(info.downloadLink.indexOf('.zip') !== -1, ' download link has .zip file')
      addonManager.installAddon(info, (err, folders) => {
        t.error(err, ' installing addons worked')
        addonManager.deleteAddon(info.name, err => {
          t.error(err, ' deleting' + info.name + ' worked')
        })
      })
    })
  })
})
