#!/usr/bin/env node
// this script crops a generated map by a json list of markers
// usage: cropMap.js <markers.json> <map.vrt> <proj> <tmpdir> <markerInfo.json> <s3bucket> <reportId>
// markers.json is an array of markers from the site
// to create markers for use with this script:
// select array_to_json(array_agg(markers)) from markers where image_id = 1184 AND volume IS NOT NULL;
var fs = require('fs');
var sys = require('sys');
var crypto = require('crypto');
var exec = require('child_process').exec;
var args = process.argv.slice(2);
var path = require('path');
var proj4 = require('proj4');
var markers = JSON.parse(fs.readFileSync(args[0]));

markers.forEach(function(marker) {
  var markerFile = randName("marker", ".json");
  var croppedTiff = randName("cropped", ".tiff");

  var bbox = boundingBoxAroundPolyCoords(marker.geojson.coordinates);
  var pMin = proj4(args[2], bbox[0]),
      pMax = proj4(args[2], bbox[1]);
  
  exec("gdalwarp -te " + pMin[0] + " " + pMin[1] + " " + pMax[0] + " " + pMax[1] + " " + args[1] + " " + croppedTiff, gdalwarp(markerFile, marker, croppedTiff));
});

function gdalwarp(markerFile, marker, croppedTiff) {
  return function(error, stdout, stderr) {
    var croppedPng = randName('croppedPng', '.png');
    exec("gdal_translate -OF png " + croppedTiff + " " + croppedPng, gdaltranslate(markerFile, marker, croppedPng));
    console.log("cropped image", croppedTiff);
  }
}

function gdaltranslate(markerFile, marker, croppedPng) {
  return function(error, stdout, stderr) {
    exec("aws s3 cp " + croppedPng + " s3://" + s3Bucket + "/" + reportId + "/", function() {
      console.log("Uploaded " + croppedPng + " to " + s3Bucket + "/" + reportId);
    });
  }
}

process.on("exit", function() {
  exec("aws s3 cp " + markerInfo + "s3:// " + s3Bucket + "/" + reportId + "/", function() {
    console.log("Uploaded markerInfo file " + markerInfo + " to " + s3Bucket + "/" + reportId);
  });
});

function boundingBoxAroundPolyCoords (coords) {
  var xAll = [], yAll = [];

  for (var i = 0; i < coords[0].length; i++) {
    xAll.push(coords[0][i][1]);
    yAll.push(coords[0][i][0]);
  }

  xAll = xAll.sort(function (a,b) { return a - b });
  yAll = yAll.sort(function (a,b) { return a - b });

  return [ [yAll[0], xAll[0]], [yAll[yAll.length - 1], xAll[xAll.length - 1]] ];
}

function randName(prefix, extension) {
  var tempDir = args[3] || null;
  var filename = (prefix || "") + crypto.randomBytes(4).readUInt32LE(0) + (extension || "");
  return tempDir ? path.join(tempDir, filename) : filename;
}
