'use strict'
const path = require('path')
const rimraf = require('rimraf')
const portals = require('./lib/sources')
const Config = require('./lib/config')
const ProjectScanner = require('./lib/project-scanner')
const Installer = require('./lib/installer');

module.exports = function (installationPath) {
  const config = new Config(installationPath);
  const scanner = new ProjectScanner(installationPath, config);
  const installer = new Installer(installationPath, config);

  const listAddons = function listAddons(cb) {
    return cb(config.get().addons)
  }

  const scanAddonFolder = function scanAddonFolder(cb) {
    scanner.scan(cb)
  }

  const deleteAddon = function deleteAddon(name, cb) {
    const cfg = config.get();
    const ix = cfg.addons.findIndex(conf => conf.name == name)

    if (ix == -1) { return cb(new Error('no addon with that name found in the addons.json file')) }

    const addon = cfg.addons[ix]

    if (addon.folders.length == 0) {
      // no installation folders found
      cfg.addons.splice(ix, 1)
      config.set(cfg);

      return cb(null)
    }

    const pattern = '{' + addon.folders.map(f => { return path.join(installationPath, f) }).join() + '}'

    rimraf(pattern, err => {
      if (err) { return cb(err) }
      cfg.addons.splice(ix, 1)
      config.set(cfg);
      return cb(null)
    })
  }

  const installAddon = function installAddon(info, cb) {
    installer.install(info, cb)
  }

  const checkForAddonUpdate = function checkForUpdate(info, cb) {
    if (portals.availablePortals.indexOf(info.portal) == -1) { return cb(new Error('unspecified or unsupported portal'), null) }
    portals[info.portal].getAddonInfo(info, function (err, addon) {
      if (err) { return cb(err, null) }

      return cb(null, {
        newVersionAvailable: info.version !== addon.version,
        localVersion: info.version,
        portalVersion: addon.version
      })
    })
  }

  return {
    listAddons,
    deleteAddon,
    installAddon,
    checkForAddonUpdate,
    portals,
    scanAddonFolder
  }
}
