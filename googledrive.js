
var fs = require('fs');
var path = require('path');
var google = require('googleapis');

var TOKEN_STORE = './.gdrive';

module.exports = {
    getClient: function(info, callback) {
        var api = google.drive, ver = 'v2';
        var scopes = ['https://www.googleapis.com/auth/drive'];

        var oauth2Client = new google.auth.OAuth2(info.clientId, info.clientSecret, info.redirectUrl);
        acquireToken(oauth2Client, scopes, function() {
            var client = api({ version: ver, auth: oauth2Client });
            callback(new Wrapper(client));
        });
    }
};

function acquireToken(oauth2Client, scopes, callback) {
  var TOKENS = null;
  try { TOKENS = JSON.parse(fs.readFileSync(TOKEN_STORE, 'utf8')); } catch (x) { console.warn(x); }
  if (TOKENS) {
    oauth2Client.setCredentials({
      access_token: TOKENS.access_token,
      refresh_token: TOKENS.refresh_token,
      expiry_date: TOKENS.expiry_date
    });

    // bug https://github.com/google/google-api-nodejs-client/issues/260
    var expiryDate = oauth2Client.credentials.expiry_date;
    var isTokenExpired = expiryDate ? expiryDate <= (new Date()).getTime() : false;
    if (isTokenExpired) {
      oauth2Client.refreshAccessToken(function(err, tokens) {
        console.log(err || tokens);
        if (!err) {
          fs.writeFileSync(TOKEN_STORE, JSON.stringify(tokens));
          callback();
        }
      });
    } else {
      callback();
    }
    return;
  }

  var url = oauth2Client.generateAuthUrl({
    access_type: 'offline', // 'online' (default) or 'offline' (gets refresh_token)
    scope: scopes // If you only need one scope you can pass it as string
  });
  console.log(url);

  var readline = require('readline');
  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  rl.question("code? ", function(code) {
    oauth2Client.getToken(code, function(err, tokens) {
      // Now tokens contains an access_token and an optional refresh_token. Save them.
      console.log(err || tokens);
      if(!err) {
        oauth2Client.setCredentials(tokens);
        fs.writeFileSync(TOKEN_STORE, JSON.stringify(tokens));
        callback();
      }
    });
    rl.close();
  });

}

function Wrapper(client) {
  this.client = client;
};

Wrapper.prototype.downloadFile = function(url, filepath, callback) {
  this._options.auth.request({ method: 'GET', url: url })
    .pipe(fs.createWriteStream(filepath))
    .on('error',  callback)
    .on('finish', callback);
}

Wrapper.prototype.getFile = function(fileId, callback) {
  this.client.files.get({
    fileId: fileId
  }, callback);
}

Wrapper.prototype.searchFile = function(query, callback) {
  var q = [];
  if (query.title) q.push("title = '" + query.title +"'");
  if (query.folder != null) {
    q.push("mimeType "+ (query.folder ? "=" : "!=") +" 'application/vnd.google-apps.folder'");
  }

  this.client.files.list({
    q: q.join(" and "),
    maxResults: 1
  }, callback);
}

Wrapper.prototype.createFolder = function(title, callback) {
  this.client.files.insert({
    resource: {
      title: title,
      mimeType: "application/vnd.google-apps.folder"
    }
  }, callback);
}

Wrapper.prototype.uploadOfficeFile = function(filepath, fileId, etag, callback) {
  var ext = path.extname(filepath);
  var mimeType = {
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  }[ext];
  if (! mimeType) throw "invalid file type.";

  var params = {
    convert: true,
    resource: {
      title: path.basename(filepath, ext),
      parents: [],
      mimeType: mimeType
    },
    media: {
      mimeType: mimeType,
      body: fs.createReadStream(filepath)
    }
  };

  var method;
  if (typeof(fileId) == 'function') {
    method = this.client.files.insert;
    callback = fileId;
  } else {
    method = this.client.files.update;
    params.fileId = fileId;
    params.options = {
      headers: {
        "If-Match": etag
      }
    };
  }
  method(params, callback);
}

