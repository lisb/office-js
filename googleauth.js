var fs = require("fs");
const { google } = require("googleapis");

var TOKEN_STORE = "./.gdrive";

module.exports = function (api, ver, scopes, Wrapper) {
    return function (info, callback) {
        var self = this;
        if (self._client) {
            callback(self._client);
        } else {
            const oauth2Client = new google.auth.OAuth2(info.clientId, info.clientSecret, info.redirectUrl);
            oauth2Client.on("tokens", (tokens) => {
                storeToken(tokens);
            });
            acquireToken(oauth2Client, scopes, function () {
                var client = api({ version: ver, auth: oauth2Client });
                callback(self._client = new Wrapper(client));
            });
        }
    };
};

function loadStoredToken() {
    try {
        if (fs.existsSync(TOKEN_STORE)) {
            return JSON.parse(fs.readFileSync(TOKEN_STORE, "utf8"));
        }
    } catch (err) {
        console.info(err);
    }
    return null;
}

function storeToken(tokens) {
    fs.writeFileSync(TOKEN_STORE, JSON.stringify(tokens));
}

function acquireToken(oauth2Client, scopes, callback) {
    const tokens = loadStoredToken();
    if (tokens) {
        oauth2Client.setCredentials({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expiry_date: tokens.expiry_date
        });

        // bug https://github.com/google/google-api-nodejs-client/issues/260
        var expiryDate = oauth2Client.credentials.expiry_date;
        var isTokenExpired = expiryDate ? expiryDate <= (new Date()).getTime() : false;
        if (isTokenExpired) {
            oauth2Client.refreshAccessToken(function (err, tokens) {
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
        access_type: "offline", // 'online' (default) or 'offline' (gets refresh_token)
        scope: scopes // If you only need one scope you can pass it as string
    });
    console.log(url);

    var readline = require("readline");
    var rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    rl.question("code? ", function (code) {
        oauth2Client.getToken(code, function (err, tokens) {
            // Now tokens contains an access_token and an optional refresh_token. Save them.
            console.log(err || tokens);
            if (!err) {
                oauth2Client.setCredentials(tokens);
                storeToken(tokens);
                callback();
            }
        });
        rl.close();
    });
}
