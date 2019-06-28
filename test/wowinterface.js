const test = require('tape')
const addons = require('../index.js')
const path = require('path')
const portals = require('../lib/sources')
const addonRoot = path.join(__dirname, 'mock')
const addonManager = addons(addonRoot)

const portal = portals['wowinterface']

test('get categories from wowinterface', t => {
    t.plan(2)
  
    portal.getCategories((err, categories) => {
      t.error(err, ' get category worked')
      t.ok(categories.length > 0, ' alteast one category returned')
    })
  })

  test('get category addons from wowinterface', t => {
    t.plan(5)
    portal.getCategories((err, categories) => {
        portal.getAddonsFromCategory(categories[0], (errAddons, addons) => {
        t.error(errAddons, ' get category worked')
        t.ok(addons.length > 0, ' alteast one category returned')
  
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
  
  test('wowinterface direct hit', t => {
    t.plan(5)
  
    portal.search('!8ball', (err, res) => {
      t.ok(res != undefined && res.length == 1, ' there was ONE match')
      t.error(err, ' no error occured')
      t.ok(typeof res[0].downloads === 'number' && res[0].downloads > 0, ' downloads is a number that is greater than zero')
  
      portal.getAddonInfo(res[0], (err, info) => {
        addonManager.installAddon(info, (err, folders) => {
          t.error(err, ' installation worked')
          addonManager.deleteAddon(info.name, err => {
            t.error(err, ' delete worked')
          })
        })
      })
    })
  })

  test('testing search wowinterface', t => {
    t.plan(2)
    portal.search('deadly', (err, res) => {
      t.ok(res.length > 0, ' atleast some search results were found')
      t.error(err, ' no error returned from search')
    })
  })

  test('install .rar addon', t => {
    t.plan(2)
    portal.search('motig', (err, res) => {
      const addon = res.filter(a => { return a.name == '!8ball' })[0]
  
      portal.getAddonInfo(addon, (err, info) => {
        addonManager.installAddon(info, (err, folders) => {
          t.error(err, ' installing addons worked')
          addonManager.deleteAddon(info.name, () => {
            t.error(err, ' deleting ' + info.name + ' worked')
          })
        })
      })
    })
  })

  test('get addon information from wowinterface', t => {
    t.plan(8)
    portal.search('bagnon', (err, res) => {
      t.ok(typeof res[0].downloads === 'number', 'downloads is a number')
      t.error(err, ' searching for addone worked')
      t.ok(res.length > 0, ' atleast one search result')
  
      portal.getAddonInfo(res[0], (err, info) => {
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
  
  test('search for addons that doesnt exist wowinterface', t => {
    t.plan(2)
  
    portal.search('I-dont-think-this-name-exists', (err, res) => {
      t.error(err, 'searching for none existing worked')
      t.ok(res.length == 0, ' no packages found, good')
  
    })
  })

  test('getting version from wowinterface', t => {
    t.plan(2);
    portal.getAddonInfo({
        name: 'Bagnon',
        link: 'http://wowinterface.com/downloads/fileinfo.php?id=4459',
        portal: 'wowinterface'}, (err, info) => {
        t.error(err, 'didnt get an error object');
        t.ok(info.version !== undefined, 'info got a version');
      })
  })