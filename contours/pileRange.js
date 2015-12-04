#!/usr/bin/env node
// pileRange.js <piles.json> <dsm.tif> <#color1,#color2...> <style.xml> <destStyle.xml>
// select array_to_json(array_agg(markers.geojson)) from markers where image_id = 1184 AND volume IS NOT NULL;
var fs = require('fs');
var crypto = require('crypto');
var sys = require('sys')
var exec = require('child_process').exec;
var args = process.argv.slice(2);
var path = require('path');

var piles = JSON.parse(fs.readFileSync(args[0]));
var outputPiles = [];
var colors = args[2].split(',');

var styleXML = fs.readFileSync(args[3], 'utf8');
var colorReliefStyleXML = '<Style name="{name}"><Rule><RasterSymbolizer mode="normal" /></Rule></Style>';
var colorReliefLayerXML = '<Layer name="{name}"><StyleName>{style_name}</StyleName><Datasource><Parameter name="type">gdal</Parameter><Parameter name="file">{croppedColorTif}</Parameter></Datasource></Layer>';

function randName(prefix, extension) {
  var filename = (prefix || "") + crypto.randomBytes(4).readUInt32LE(0) + (extension || "");
  return filename;
}

function hexToRgb(hex) {
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return parseInt(result[1], 16) + " " + parseInt(result[2], 16) + " " + parseInt(result[3], 16);
}

function gdalwarp(croppedTif, pileFile) { 
  return function(error, stdout, stderr) {
    exec("gdalinfo -mm " + croppedTif, gdalinfo(croppedTif, pileFile));
  }
}

function gdalinfo(croppedTif, pileFile) {
  return function (error, stdout, stderr) {
    var range = stdout.match(/Computed Min\/Max=(\d+.\d+),(\d+.\d+)/i);
    var min = parseFloat(range[1]),
        max = parseFloat(range[2]);

    var interval = (max - min) / colors.length,
        current = min;

    console.log(min, max, interval, current);


    var colorRamp = [];
    for(var i = 0; i < colors.length; i++) {
      colorRamp.push(current.toFixed(2) + " " + hexToRgb(colors[i]));
      current += interval;
    }
    var colorRampFile = randName('ramp', '.txt');
    fs.writeFileSync(colorRampFile, colorRamp.join("\n"));
    var outputColorTif = randName('colorrelief', '.tif');
    exec("gdaldem color-relief " + croppedTif + " " + colorRampFile + " " + outputColorTif, gdalem(outputColorTif, pileFile));
  }
}

function gdalem(outputColorTif, pileFile) {
  return function (error, stdout, stderr) {
    var croppedColorTif = randName('colorreliefcrop', '.tif');
    exec("gdalwarp -dstalpha -of Gtiff -crop_to_cutline -cutline " + pileFile + " " + outputColorTif + " " + croppedColorTif, gdalemCrop(croppedColorTif));
    //console.log("created output color tif", outputColorTif);
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

process.on('exit', function() {
  fs.writeFileSync(args[4], styleXML.replace(/\$colorReliefStyles/g, styles.join("\n")).replace(/\$colorReliefLayers/g, layers.join("\n")));

  console.log("Wrote output map style", args[4]);
});

piles.forEach(function(pile) {
  var pileFile = randName('pile', '.json'),
      croppedTif = randName('dsm', '.tif');

  fs.writeFileSync(pileFile, JSON.stringify(pile));
  exec("gdalwarp -of Gtiff -crop_to_cutline -cutline " + pileFile + " " + args[1] + " " + croppedTif, gdalwarp(croppedTif, pileFile));
});
