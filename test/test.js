'use strict'
const test = require('tape')
const addons = require('../index.js')
const path = require('path')
const portals = require('../lib/sources')
const addonRoot = path.join(__dirname, 'mock')
const addonManager = addons(addonRoot)



test('sending null path', t => {
  t.plan(2)
  t.throws(() => addons(null), 'installation path is empty or wrong type')
  t.throws(() => addons(), 'installation path is empty or wrong type')
})

test('get categories from curse', t => {
  t.plan(2)
  portals['curse'].getCategories((err, categories) => {
    t.error(err, ' get category')
    t.ok(categories.length > 0, ' alteast one category returned')
  })
})

test('get category addons from curse', t => {
  t.plan(5)
  portals['curse'].getCategories((err, categories) => {

    portals['curse'].getAddonsFromCategory(categories[0], (errAddons, addons) => {
      t.error(errAddons, ' get category')
      t.ok(addons.length > 0, ' alteast one category returned')


      portals['curse'].getAddonInfo(addons[0], (err, info) => {
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

  portals['curse'].search('deadly', (err, res) => {
    t.ok(res.length > 0, ' atleast some search results were found')
    t.error(err, ' no error returned from search')
    t.ok(typeof res[0].downloads === 'number' && res[0].downloads > 2000000, ' downloads is a number that is greater than zero')
  })
})


test('create dummy addon', t => {
  t.plan(2)
  addonManager.createAddon('dummy', (err, addonPath) => {
    t.error(err, 'addon creation success')
    t.equals(addonPath, path.join(addonRoot, 'dummy'))
  })
})

test('get addons from addons.json', t => {
  t.plan(1)
  addonManager.listAddons(addons => {
    t.ok(addons.length >= 1, 'atleast one addon found')
  })
})

test('delete addon', t => {
  t.plan(1)
  addonManager.deleteAddon('dummy', err => {
    t.error(err, 'deleting addon success')
  })
})



test('get addon information from curse', t => {
  t.plan(7)

  portals['curse'].search('bagnon', (err, res) => {
    t.ok(typeof res[0].downloads === 'number', 'downloads is a number')
    t.error(err, ' searching for addone worked')
    t.ok(res.length > 0, ' atleast one search result')
    portals['curse'].getAddonInfo(res[0], (err, info) => {
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
  portals['curse'].search('I-dont-think-this-name-exists', (err, res) => {
    t.error(err, 'searching for none existing worked')
    t.ok(res.length == 0, ' no packages found, good')
  })
})

test('check for updates', t => {
  t.plan(2)

  portals['curse'].search('bagnon', (err, res) => {
    portals['curse'].getAddonInfo(res[0], (err, info) => {
      addonManager.installAddon(info, (err, folders) => {
        addonManager.listAddons(addons => {
          addonManager.checkForAddonUpdate(addons[0], (err, versionInfo) => {
            t.error(err, 'check for update didnt crash. good')
            addonManager.deleteAddon(info.name, err => {
              t.error(err, ' deleting' + info.name + ' worked')
            })
          })
        })
      })
    })
  })
})



////Fix this test, move addons from another folder or install addon
// test('scan addon folder', t => {
//   t.plan(1)

//   addonManager.scanAddonFolder((err, result) => {
//     addonManager.listAddons(addons => {
//       let count = 0;

//       const getInfoAndInstall = (a) => addonManager.checkForAddonUpdate(a, (err, versionInfo) => {
//         portals[a.portal].getAddonInfo(a, (err, info) => {
//           addonManager.installAddon(info, (err, folders) => {
//             count++;
//             if (count == addons.length) {
//               addonManager.listAddons(ads => { t.ok(!ads.some(b => b.version == '' || b.version == undefined)); })
//             } else {
//               getInfoAndInstall(addons[count]);
//             }
//           })
//         });
//       })

//       getInfoAndInstall(addons[count]);
//     });
//   });
// })

test('getting version from curse', t => {
  t.plan(2);
  portals['curse'].getAddonInfo({
      name: 'Bagnon',
      link: 'https://www.curseforge.com/wow/addons/bagnon',
      portal: 'curse'}, (err, info) => {
      t.error(err, 'didnt get an error object');
      t.ok(info.version !== undefined, 'info got a version');
    })
})