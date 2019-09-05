const glob = require('glob')
const path = require('path')
const wowtoc = require('wow-toc')

class ProjectScanner {
    constructor(installationPath, config) {
        this.installationPath = installationPath
        this.config = config
    }

    _addMissingAddons(addons) {
        const cfg = this.config.get();

        for (let i = 0; i < addons.length; i++) {
            if (!cfg.addons.some(conf => { return conf.name == addons[i].name && conf.portal == addons[i].portal })) {
                cfg.addons.push(addons[i])
            }
        }

        this.config.set(cfg);
    }

    _search(name, cb) {
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

    scan(cb) {
        glob(`${this.installationPath}/*/*.toc`, (err, files) => {
            if (err) return cb(err, null)
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

            for (let i = 0; i < curseData.length; i++) {
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
                .filter((v, i, a) => a.map(b => b.tags.Title).indexOf(v.tags.Title) === i);

            let addonsSearched = 0
            unknownAddons.forEach(ua => {
                this._search(ua.tags.Title, (err, searchResults) => {
                    addonsSearched++

                    if (err == null && searchResults.length > 0) {
                        installed.push({
                            name: searchResults[0].name,
                            folders: [], //we could add folders, but then we would to have to get details and download the addon too.
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
                        this._addMissingAddons(installed)
                        return cb(null, { installed, unmatched })
                    }
                })
            })
        })
    }
}

module.exports = ProjectScanner