'use strict'
const test = require('tape')
const addons = require('../index.js')
const path = require('path')
const portals = require('../lib/sources')
const addonRoot = path.join(__dirname, 'mock')
const addonManager = addons(addonRoot)

const portal = portals['curse']

test('sending null path', t => {
  t.plan(2)
  t.throws(() => addons(null), 'installation path is empty or wrong type')
  t.throws(() => addons(), 'installation path is empty or wrong type')
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