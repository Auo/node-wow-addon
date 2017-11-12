'use strict'
const wowtoc = require('wow-toc')
const path = require('path')
const fs = require('fs')
const rimraf = require('rimraf')
const request = require('request')
const AdmZip = require('adm-zip')
const jsonfile = require('jsonfile')
const portals = require('./lib/sources')
const sanitize = require('sanitize-filename')
const unrar = require('unrar-js')
const mkdirp = require('mkdirp')
const glob = require('glob')


module.exports = function (installationPath) {

  if (!installationPath || typeof installationPath !== 'string') {
    throw new Error('installation path is empty or wrong type')
  }

  if (!folderExists(path.join(installationPath, 'addons.json'))) {
    fs.writeFileSync(path.join(installationPath, 'addons.json'), '{"addons":[]}')
  }

  const listAddons = function listAddons(cb) {
    const config = jsonfile.readFileSync(path.join(installationPath, 'addons.json'))
    return cb(config.addons)
  }

  const scanAddonFolder = function scanAddonFolder(cb) {
    glob(installationPath + '/*/*.toc', (err, files) => {
      //{tags:{}, files:[]}
      const tocs = files.map(file => {
        const content = fs.readFileSync(file, 'utf8')
        const addonInfo = wowtoc.parse(content)
        addonInfo.path = file
        return addonInfo
      })

      if (tocs.length == 0) {
        return cb(null, { installed: [], unmatched: [] })
      }

      const curseAddons = tocs.filter(toc => toc.tags['X-Curse-Project-ID'] != undefined)
      let unknownAddons = tocs.filter(toc => toc.tags['X-Curse-Project-ID'] == undefined)

      const curseData = curseAddons.map(curse => {
        return {
          path: curse.path,
          name: curse.tags['X-Curse-Project-Name'],
          link: 'https://www.curseforge.com/wow/addons/' + curse.tags['X-Curse-Project-ID'],
          version: curse.tags['X-Curse-Packaged-Version']
        }
      })

      const installed = []
      const unmatched = []

      for (var i = 0; i < curseData.length; i++) {
        const installPathsForAddon = curseData.filter(c => { return c.name == curseData[i].name && c.link == curseData[i].link && c.version == curseData[i].version })
          .map(c => { return c.path })
          .filter((value, index, self) => { return self.indexOf(value) === index })
          .map(p => {
            const withoutFile = path.dirname(p)
            const folderName = withoutFile.substring(withoutFile.lastIndexOf('/') + 1, withoutFile.length)
            return folderName
          })

        if (!installed.some(c => { return c.name == curseData[i].name && c.link == curseData[i].link && c.version == curseData[i].version })) {
          installed.push({
            name: curseData[i].name,
            folders: installPathsForAddon,
            link: curseData[i].link,
            version: curseData[i].version,
            portal: 'curse'
          })
        }
      }

      if (unknownAddons.length == 0) {
        return cb(null, { installed, unmatched })
      }

      for (let ua of unknownAddons) {
        if (ua.tags.Title) {
          ua.tags.Title = ua.tags.Title.replace(/(\[(.*?)\])|(\|r)|(\|[a-z0-9]{9})/g, '').trim()
        }
      }

      unknownAddons = unknownAddons.filter(ua => !!ua.tags.Title)
      .filter((v, i, a) => a.map(b=>b.tags.Title).indexOf(v.tags.Title) === i);

      let addonsSearched = 0
      unknownAddons.forEach(ua => {

        search(ua.tags.Title, (err, searchResults) => {
          addonsSearched++

          if (err == null && searchResults.length > 0) {
            installed.push({
              name: searchResults[0].name,
              folders: [], //we could add folders, but then we would to have to get detais and download the addon too.
              link: searchResults[0].link,
              version: '', //same as for folders
              portal: searchResults[0].portal
            })
          } else {
            unmatched.push({
              name: ua.tags.Title
            })
          }

          if (addonsSearched == unknownAddons.length) {
            addMissingAddons(installed)
            return cb(null, { installed, unmatched })
          }
        })
      })
    })

    function addMissingAddons(addons) {
      const config = jsonfile.readFileSync(path.join(installationPath, 'addons.json'))

      for (var i = 0; i < addons.length; i++) {
        if (!config.addons.some(conf => { return conf.name == addons[i].name && conf.portal == addons[i].portal })) {
          config.addons.push(addons[i])
        }
      }

      jsonfile.writeFileSync(path.join(installationPath, 'addons.json'), config)
    }

    function search(name, cb) {
      const p = portals.availablePortals
      let results = []
      let completedSearches = 0

      for (let i = 0; i < p.length; i++) {
        portals[p[i]].search(name, (err, addons) => {
          if (err) { return cb(err, null) }
          completedSearches++
          if (addons != null) { results = results.concat(addons) }
          if (completedSearches == p.length) { return cb(null, results.sort((a, b) => { return b.downloads - a.downloads })) }
        })
      }
    }
  }

  const deleteAddon = function deleteAddon(name, cb) {
    const config = jsonfile.readFileSync(path.join(installationPath, 'addons.json'))
    const installedAddons = config.addons.filter(conf => { return conf.name == name })

    if (installedAddons.length == 0) { return cb(new Error('no addon with that name found in the addons.json file')) }

    const glob = installedAddons[0].folders.length > 1
      ? '{' + installedAddons[0].folders.map(f => { return path.join(installationPath, f) }).join() + '}'
      : path.join(installationPath, installedAddons[0].folders[0])

    rimraf(glob, err => {
      if (err) { return cb(err) }
      const index = config.addons.indexOf(installedAddons[0])
      config.addons.splice(index, 1)
      jsonfile.writeFileSync(path.join(installationPath, 'addons.json'), config)
      return cb(null)
    })
  }

  const createAddon = function createAddon(name, cb) {
    const addonPath = path.join(installationPath, name)
    if (folderExists(addonPath)) { return cb(new Error('addon folder already exists'), null) }

    const config = jsonfile.readFileSync(path.join(installationPath, 'addons.json'))
    config.addons.push({
      name,
      link: null,
      folders: [name],
      portal: null,
      version: '1.0'
    })
    fs.mkdirSync(addonPath)
    fs.writeFileSync(path.join(addonPath.toString(), name + '.toc'),
      '## Interface: 60200 \n## Title: ' + name + ' \n## Notes: what to do \n## Version: 1.0', 'utf8')

    jsonfile.writeFileSync(path.join(installationPath, 'addons.json'), config)
    return cb(null, addonPath)
  }

  const installAddon = function installAddon(info, cb) {
    let fileEnding = info.downloadLink.substring(info.downloadLink.lastIndexOf('.'), info.downloadLink.length)

    if (fileEnding != '.zip' && fileEnding != '.rar') {
      if (info.portal === 'curse') {
        fileEnding = '.zip'; //assume it's zip
      } else {
        return cb(new Error('file-type not supported: ' + fileEnding), null)
      }
    }

    const tempZipName = sanitize(info.name + '-' + info.version + fileEnding).replace(/ /g, '')
    const config = jsonfile.readFileSync(path.join(installationPath, 'addons.json'))

    const preExisting = config.addons.filter(conf => conf.name === info.name)

    const stream = fs.createWriteStream(path.join(installationPath, tempZipName))

    request(info.downloadLink)
      .on('error', (err) => {
        return cb(err, null)
      }).pipe(stream)

    stream.on('finish', function () {
      if (fileEnding == '.zip') {
        const zip = new AdmZip(path.join(installationPath, tempZipName))
        const zipEntries = zip.getEntries()

        const folders = zipEntries.map(entry => entry.entryName.substring(0, entry.entryName.indexOf('/')))
          .filter((value, index, self) => self.indexOf(value) === index)

        if (preExisting.length == 0) {
          config.addons.push({
            name: info.name,
            link: info.link,
            folders,
            portal: info.portal,
            version: info.version
          })
        } else {
          const index = config.addons.indexOf(preExisting[0])
          config.addons[index].portal = info.portal
          config.addons[index].version = info.version
          config.addons[index].folders = folders
        }

        jsonfile.writeFileSync(path.join(installationPath, 'addons.json'), config)
        const foldersToRemove = folders.filter(f => { return folderExists(path.join(installationPath, f)) })

        if (foldersToRemove.length > 0) {
          const glob = foldersToRemove.length > 1 ?
            '{' + foldersToRemove.map(f => { return path.join(installationPath, f) }).join() + '}'
            : path.join(installationPath, foldersToRemove[0])


          rimraf(glob, (err) => {
            if (err) { return cb(err, null) }

            zip.extractAllTo(installationPath)
            fs.unlinkSync(path.join(installationPath, tempZipName))
            return cb(null, folders)
          })
        } else {
          zip.extractAllTo(installationPath)
          fs.unlinkSync(path.join(installationPath, tempZipName))
          return cb(null, folders)
        }

      }
      else if (fileEnding == '.rar') {
        const unpackedFiles = unrar.unrarSync(path.join(installationPath, tempZipName))
        const folders = unpackedFiles.map(file => file.filename)
          .map(p => p.substring(0, p.lastIndexOf('/')))

        const rootFolders = folders
          .map(entry => {
            if (entry.indexOf('/') == -1) {
              return entry
            } else {
              return entry.substring(0, entry.indexOf('/'))
            }
          })
          .filter((value, index, self) => { return self.indexOf(value) === index })

        if (preExisting.length == 0) {
          config.addons.push({
            name: info.name,
            link: info.link,
            folders: rootFolders,
            portal: info.portal,
            version: info.version
          })
        } else {
          const index = config.addons.indexOf(preExisting[0])
          config.addons[index].portal = info.portal
          config.addons[index].version = info.version
          config.addons[index].folders = rootFolders
        }

        jsonfile.writeFileSync(path.join(installationPath, 'addons.json'), config)
        const foldersToRemove = folders.filter(f => { return folderExists(path.join(installationPath, f)) })

        if (foldersToRemove.length > 0) {
          const glob = foldersToRemove.length > 1 ?
            '{' + foldersToRemove.map(f => { return path.join(installationPath, f) }).join() + '}'
            : path.join(installationPath, foldersToRemove[0])


          rimraf(glob, (err) => {
            if (err) { return cb(err, null) }

            for (let i = 0; i < folders.length; i++) {
              try {
                mkdirp.sync(path.join(installationPath, folders[i]))
              } catch (err) { return cb(err, null) }
            }
            //
            for (let i = 0; i < unpackedFiles.length; i++) {
              fs.appendFileSync(path.join(installationPath, unpackedFiles[i].filename), new Buffer(unpackedFiles[i].fileData))
            }

            fs.unlinkSync(path.join(installationPath, tempZipName))
            return cb(null, folders)
          })
        } else {
          for (let i = 0; i < folders.length; i++) {
            try {
              mkdirp.sync(path.join(installationPath, folders[i]))
            } catch (err) {
              return cb(err, null)
            }
          }

          for (let i = 0; i < unpackedFiles.length; i++) {
            fs.appendFileSync(path.join(installationPath, unpackedFiles[i].filename), new Buffer(unpackedFiles[i].fileData))
          }

          fs.unlinkSync(path.join(installationPath, tempZipName))
          return cb(null, rootFolders)
        }
      }
    })
  }

  const checkForAddonUpdate = function checkForUpdate(info, cb) {
    console.log(info.portal);
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

  function folderExists(path) {
    try {
      fs.accessSync(path, fs.F_OK);
      return true
    } catch (e) {
      return false
    }
  }

  return {
    listAddons,
    createAddon,
    deleteAddon,
    installAddon,
    checkForAddonUpdate,
    portals,
    scanAddonFolder
  }
}
