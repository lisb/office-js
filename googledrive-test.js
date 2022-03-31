
var gdrive = require("./googledrive");

var cb = function (callback) {
    return function (err, response) {
        if (err) {
            console.log("[ERROR] " + (err.responseText || ""));
            console.log(err);
        } else {
            console.log("[Success]");
            console.log(response);
            callback(err, response);
        }
    };
};

var CLIENT_ID = process.env.CLIENT_ID;
var CLIENT_SECRET = process.env.CLIENT_SECRET;

var info = {
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    redirectUrl: "http://localhost:3000/",
};

gdrive.getClient(info, function (client) {
    client.createFolder("Test Folder", cb(function (err, result) {
        client.uploadOfficeFile("sample.docx", cb(function (err, result) {
            client.searchFile({ title: "sample" }, cb(function (err, result) {
                client.getFile(result.id, cb(function (err, result) {
                    client.downloadFile(result, "download.docx", cb(function (err, result) {
                    }));
                }));
            }));
        }));
    }));
});
