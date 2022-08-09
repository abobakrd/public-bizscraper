const _https = require('https');
const _http = require('http');
const http_prts = {
   http: _http,
   https: _https
};

_http.globalAgent.maxSockets = 500;
_https.globalAgent.maxSockets = 500;

let urls = [];
module.exports = function Request(url, require_json = false) {

   return new Promise(((resolve, reject) => {
      console.log('_request: ', url);

      urls.push(urls);

      let protocol;
      if (/^https/.test(url))
         protocol = 'https';
      else if (/^http/.test(url))
         protocol = 'http';
      else
         return reject('invalid protocol for url ' + url);

      http_prts[protocol].request(url, res => {

         if (res.statusCode !== 200) return reject('NON 200 HTTP STATUSCODE')

         if (require_json && !/application\/json;\s?charset=UTF-8/i.test(res.headers['content-type'])) {
            return reject('invalid_content_type for url' + url);
         }

         let buffers = [];
         res.on('data', buff => buffers.push(buff));

         res.on('end', () => {
            console.log('_request: OnEnd Called for url ', url);

            try {
               return resolve(JSON.parse(Buffer.concat(buffers).toString()));
            } catch (error) {
               return new Error('Request returned a non-JSON response.');
            }
         });
      }).on('error', err => {
         console.error('_request error for url ', url, '\nError: ', err);
         return reject(err);
      }).end();
   }));
}