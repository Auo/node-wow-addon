'use strict'
const request = require('request')
const ROOTURL = 'http://wowinterface.com'
module.exports = {
  getAddonInfo: function getAddonInfo(info, cb) {
    request(info.link, (err, response) => {
      if(err) { return cb(err, null) }
      if(response.statusCode !== 200) { return cb(new Error('addon not found'), null)  }

      const version = this._getVersion(response.body)
      this._getDownloadLink(info.link, (err, downloadLink) => {
        return cb(null, {
          name: info.name,
          version,
          link: info.link,
          downloadLink,
          portal: 'wowinterface'
         })
      })
    })
  },
  search: function search(name, cb) {
    request.post({url: ROOTURL + '/downloads/search.php', form: { x: 0, y:0, search: name }}, (err, response) => {
      if(err) { return cb(err, null) }
      if(response.statusCode !== 200) { return cb(new Error('addon not found'), null)  }
      return cb(null, this._getSearchResults(response.body))
    })
  },

  _getSearchResults: function(html) {
    const re = /<tr>[\s\S]*?<\/tr>/g
    const nameRe = />([^<]+)<\/a>/g
    const linkRe = /fileinfo\.php\?s=[^&]+&amp;(id=[0-9]+)"/g
    const downRe = /<td align="center" class="[a-z0-9]+">([\d,.]+)<\/td>/g

    const searchResults = html.match(re).filter(res => { return res.indexOf('searchcaticon') !== -1 })


    const results = searchResults == null || searchResults.length == 0 ? [] : searchResults.map(res => {
      const nameParts = res.match(nameRe)
      const link = res.match(linkRe)
      const downloads = res.match(downRe)

      return {
        name: nameParts[0].replace('</a>','').replace('>',''),
        creator: nameParts[1].replace('</a>','').replace('>',''),
        link: ROOTURL + '/downloads/' + link[0].substring(0, link[0].indexOf('s=')) + link[0].substring(link[0].indexOf('id='), link[0].length - 1 ),
        downloads: downloads[0].substring(downloads[0].indexOf('>') + 1, downloads[0].indexOf('</td>')),
        portal: 'wowinterface'
      }
    })
    return results
  },
  _getVersion: function(html) {
    const re = /Version:([^<]+)/g
    return html.match(re)[0].replace('Version: ','')
  },
  _getDownloadLink: function(link, cb) {
     const re = /<a href="([^"]+)">Click here/g
     const downloadPage = ROOTURL + '/downloads/landing.php?fileid=' + link.substring(link.indexOf('id=') + 3, link.length)

    request(downloadPage, (err, response) => {
      if(err) { return cb(err, null) }
      if(response.statusCode !== 200) { return cb(new Error('addon not found'), null)  }
      const link  = response.body.match(re)
      const downloadUrl = link[0].substring(0, link[0].indexOf('?')).replace('<a href="','')

      return cb(null, downloadUrl)
    })
  }
}
