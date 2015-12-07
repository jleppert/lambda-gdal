#!/usr/bin/env node
// this script takes a dsm and list of markers and creates colored elevation maps for each marker and outputs the details of each dsm (color ramp, min/max, etc) to a json file
// usage: markerRange.js <markers.json> <dsm.tif> <#color1,#color2...> <style.xml> <destStyle.xml> <markerInfo.json> <tmpdir>
// markers.json is an array of markers from the site
// to create markers for use with this script:
// select array_to_json(array_agg(markers)) from markers where image_id = 1184 AND volume IS NOT NULL;
var fs = require('fs');
var crypto = require('crypto');
var sys = require('sys');
var exec = require('child_process').exec;
var args = process.argv.slice(2);
var path = require('path');

var markers = JSON.parse(fs.readFileSync(args[0]));
var colors = args[2].split(',');

var styleXML = fs.readFileSync(args[3], 'utf8');
var colorReliefStyleXML = '<Style name="{name}"><Rule><RasterSymbolizer mode="normal" /></Rule></Style>';
var colorReliefLayerXML = '<Layer name="{name}"><StyleName>{style_name}</StyleName><Datasource><Parameter name="type">gdal</Parameter><Parameter name="file">{croppedColorTif}</Parameter></Datasource></Layer>';

function randName(prefix, extension) {
  var tempDir = args[6] || null;
  var filename = (prefix || "") + crypto.randomBytes(4).readUInt32LE(0) + (extension || "");
  return tempDir ? path.join(tempDir, filename) : filename;
}

function hexToRgb(hex) {
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return parseInt(result[1], 16) + " " + parseInt(result[2], 16) + " " + parseInt(result[3], 16);
}

function gdalwarp(croppedTif, markerFile, marker) { 
  return function(error, stdout, stderr) {
    exec("gdalinfo -mm " + croppedTif, gdalinfo(croppedTif, markerFile, marker));
  }
}

var siteMarkerInfo = {};
function gdalinfo(croppedTif, markerFile, marker) {
  return function (error, stdout, stderr) {
    var range = stdout.match(/Computed Min\/Max=(\d+.\d+),(\d+.\d+)/i);
    var min = parseFloat(range[1]),
        max = parseFloat(range[2]);

    var interval = (max - min) / colors.length,
        current = min;

    var colorRamp = [];
    var markerDetails = {
      colorScale: [],
      min: min,
      max: max,
      interval: interval
    };

    for(var i = 0; i < colors.length; i++) {
      markerDetails.colorScale.push({ value: current, color: colors[i] });
      colorRamp.push(current.toFixed(2) + " " + hexToRgb(colors[i]));
      current += interval;
    }
    siteMarkerInfo[marker.id] = markerDetails;

    var colorRampFile = randName('ramp', '.txt');
    fs.writeFileSync(colorRampFile, colorRamp.join("\n"));
    var outputColorTif = randName('colorrelief', '.tif');
    exec("gdaldem color-relief " + croppedTif + " " + colorRampFile + " " + outputColorTif, gdalem(outputColorTif, markerFile));
  }
}

function gdalem(outputColorTif, markerFile) {
  return function (error, stdout, stderr) {
    var croppedColorTif = randName('colorreliefcrop', '.tif');
    exec("gdalwarp -dstalpha -of Gtiff -crop_to_cutline -cutline " + markerFile + " " + outputColorTif + " " + croppedColorTif, gdalemCrop(croppedColorTif));
    console.log("created output color tif", outputColorTif);
  }
}

var styles = [];
var layers = [];
function gdalemCrop(croppedColorTif) {
  return function (error, stdout, stderr) {
    var styleName = randName(),
        layerName = randName();

    styles.push(colorReliefStyleXML.replace('{name}', styleName));
    layers.push(colorReliefLayerXML.replace('{name}', layerName).replace('{style_name}', styleName).replace('{croppedColorTif}', path.resolve(croppedColorTif)));
    console.log("created cropped output color tif", croppedColorTif);
  }
}


function boundingBoxAroundPolyCoords (coords) {
  var xAll = [], yAll = [];

  for (var i = 0; i < coords[0].length; i++) {
    xAll.push(coords[0][i][1]);
    yAll.push(coords[0][i][0]);
  }

  xAll = xAll.sort(function (a,b) { return a - b });
  yAll = yAll.sort(function (a,b) { return a - b });

  return [ [xAll[0], yAll[0]], [xAll[xAll.length - 1], yAll[yAll.length - 1]] ];
}

process.on('exit', function() {
  fs.writeFileSync(args[4], styleXML.replace(/\$colorReliefStyles/g, styles.join("\n")).replace(/\$colorReliefLayers/g, layers.join("\n")));
  console.log("Wrote output map style", args[4]);
  fs.writeFileSync(args[5], JSON.stringify(siteMarkerInfo));
  console.log("Wrote output marker summary json", args[5]);
});

markers.forEach(function(marker) {
  var markerFile = randName('marker', '.json'),
      croppedTif = randName('dsm', '.tif');

      console.log('cropped tif', croppedTif);

  fs.writeFileSync(markerFile, JSON.stringify(marker.geojson));
  exec("gdalwarp -of Gtiff -crop_to_cutline -cutline " + markerFile + " " + args[1] + " " + croppedTif, gdalwarp(croppedTif, markerFile, marker));
});
