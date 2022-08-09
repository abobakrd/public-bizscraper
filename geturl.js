const _follow_redirects = require('follow-redirects');
const _https = require('https');
const _http = require('http');
const http_protocols = { https: _https, http: _http };

function tryGetValidUrl(url) {
   if (url.length < 1) return false;

   let urlRxp = /(?<prtc>https?:\/\/)?(?<w3>www\.)?(?<dmn>[-a-zA-Z0-9@:%._\+~#=]{1,256}\.)(?<ext>[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*))/;
   let groups = url.match(urlRxp).groups;
   if (groups)
      if (groups.dmn && groups.ext) {
         url = '';
         if (groups.prtc) url += groups.prtc; else url += 'http://';
         if (groups.w3) url += groups.w3;
         url += groups.dmn + groups.ext;
         return url;
      }

   return false;
}

function GetHttpProtocol(url) {
   return /^https/.test(url) ? 'https' : 'http';
}

function FollowHttpRedirects(url, protocol) {
   return new Promise((resolve, reject) => {
      _follow_redirects[protocol].get(url, r => {
         // console.log(r);
         return resolve(r.responseUrl);
      }).on('error', err => reject(err)).end();
   });
}


function TestHttpStatus(url, protocol) {
   return new Promise((resolve, reject) => {
      http_protocols[protocol].get(url, r => {
         return resolve(r.statusCode);
      }).on('error', err => reject(err)).end();
   });
}

module.exports = function GetFinalUrl(url) {
   return new Promise((resolve, reject) => {
      // if (/tgrinde/g.test(url))
      //    debugger;
      url = tryGetValidUrl(url);
      if (!url) return resolve({ httpStatusCode: 'invalid URL syntax', errCode: 'invalid url scheme!' });
      FollowHttpRedirects(url, GetHttpProtocol(url)).then(newUrl => {
         if (newUrl !== url) {
            url = tryGetValidUrl(newUrl);
            if (!url) return resolve({ httpStatusCode: 'invalid URL syntax', errCode: 'invalid url scheme!' });
         }

         return TestHttpStatus(url, GetHttpProtocol(url));
      }).then(statusCode => {
         resolve({ httpStatusCode: statusCode, finalUrl: url });
      }).catch(err => {
         resolve({ httpErr: true, httpStatusCode: err.code, errCode: err.code });
      });
   });
}