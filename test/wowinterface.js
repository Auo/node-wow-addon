const test = require('tape')
const addons = require('../index.js')
const path = require('path')
const portals = require('../lib/sources')
const addonRoot = path.join(__dirname, 'mock')
const addonManager = addons(addonRoot)

const portal = portals['wowinterface']

test('get categories', t => {
  t.plan(3)

  portal.getCategories((err, categories) => {
    t.error(err, ' get category worked')
    t.ok(categories.length > 0, ' alteast one category returned')
    t.equals(categories.length, 52)
  })
})

test('get addons from cateogory', t => {
  t.plan(2)
  const category = {
    "link": 'https://www.wowinterface.com/downloads/cat19.html',
    "name": 'Action Bar Mods',
    "subCategories": [],
    "portal": 'wowinterface'
  }

  portal.getAddonsFromCategory(category, (errAddons, addons) => {
    t.error(errAddons, ' get category worked')
    t.ok(addons.length > 0, ' alteast one addon found category')
  })
})

test('get info about addon', t => {
  t.plan(3)
  const addonFromCategory = {
    "name": 'Masque',
    "link": 'https://wowinterface.com/downloads/fileinfo.php?id=12097',
    "creator": 'StormFX',
    "image": 'http://cdn-wow.mmoui.com/images/icons/m19.jpg',
    "downloads": 320641,
    "category": 'Action Bar Mods',
    "portal": 'wowinterface'
  }
  portal.getAddonInfo(addonFromCategory, (err, info) => {
    t.error(err, ' getting addon worked')
    t.ok(info.downloadLink.startsWith('https://cdn.wowinterface.com/downloads/file12097/'))
    t.equals(info.portal, 'wowinterface')
  })
})

test('direct search hit', t => {
  t.plan(4)

  portal.search('!8ball', (err, res) => {
    t.ok(typeof res[0].downloads === 'number', 'downloads is a number')
    t.ok(res != undefined && res.length == 1, ' there was ONE match')
    t.error(err, ' no error occured')
    t.ok(typeof res[0].downloads === 'number' && res[0].downloads > 0, ' downloads is a number that is greater than zero')
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

  const addon = {
    "name": '!8ball',
    "creator": 'Motig',
    "link": 'https://wowinterface.com/downloads/fileinfo.php?id=17796',
    "downloads": 3057,
    "image": 'http://cdn-wow.mmoui.com/images/icons/m100.jpg',
    "category": 'Mini Games, ROFL',
    "portal": 'wowinterface'
  }

  portal.getAddonInfo(addon, (err, info) => {
    addonManager.installAddon(info, (err, folders) => {
      t.error(err, ' installing addons worked')
      addonManager.deleteAddon(info.name, () => {
        t.error(err, ' deleting ' + info.name + ' worked')
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
    portal: 'wowinterface'
  }, (err, info) => {
    t.error(err, 'didnt get an error object');
    t.ok(info.version !== undefined, 'info got a version');
  })
})