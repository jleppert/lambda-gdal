var fs            = require('fs'),
    tempfile      = require('tempfile'),
    Promise       = require('bluebird'),
    request       = require('request'),
    Canvas        = require('canvas'),
    Image         = Canvas.Image,
    gdal          = require('gdal'),
    sig           = require('amazon-s3-url-signer'),
    child_process = require('child_process'),
    path          = require('path'),
    config        = Object.freeze(require('./config.json'));

Promise.promisifyAll(request, { multiArgs: true });

var signer = sig.urlSigner(config.s3.access, config.s3.secret, {
  protocol: 'http'
});

process.on('message', function(message) {
  var dsmUrl = signer.getUrl('GET', message.dsm.key, message.dsm.bucket, 600);
  request.getAsync({ url: dsmUrl, encoding: null, gzip: true }).spread(function(res, body) {
    var dsmTmp = tempfile('.dsm');
    fs.writeFileSync(dsmTmp, body);

    var rasterDSM = gdal.open(dsmTmp);
    rasterDSM.bands.forEach(function(band) {
      var rawBuffer = new ArrayBuffer((band.size.x * band.size.y) * 4);
      var bandData = new Float32Array(rawBuffer);
      var bandData8 = new Uint8Array(rawBuffer);
          
      band.pixels.read(0, 0, band.size.x, band.size.y, bandData);
          
      var heightMap = new Canvas(band.size.x, band.size.y),
          ctx       = heightMap.getContext('2d'),
          imageData = ctx.createImageData(band.size.x, band.size.y);

      imageData.data.set(bandData8);
      ctx.putImageData(imageData, 0, 0);
      
      var png = tempfile('.png');
      fs.writeFileSync(png, heightMap.toBuffer());
      
      child_process.exec(['./gdal.sh', dsmTmp, png, message.zoom].join(' '), {
        env: {
          PATH: process.env['PATH'],
          LD_LIBRARY_PATH: process.env['LD_LIBRARY_PATH'],
          PYTHONPATH: process.env['PYTHONPATH'] + ':' + path.join(process.env['TASK_ROOT'], "/" + config.gdal.python_package + "/"),
          GDAL_DATA: path.join(process.env['TASK_ROOT'], '/local/share/gdal')
        }
      }, function(error, stdout, stderr) {
        if(stdout) {
          var output = stdout.match(/(Tiles generated to: )(.+)/im);
          if(!stderr) stderr = undefined;
           
          var outputDirectory = output[2] || "";
          process.send({
            output: outputDirectory.trim(),
            stdout: stdout,
            stderr: stderr,
            png: png,
            dsm: dsmTmp,
            request: message,
            env: process.env
          });
        } else {
          process.send({
            stdout: null,
            stderr: stderr,
            png: png,
            dsm: dsmTmp,
            request: message,
            env: process.env
          });
        }

        if (error !== null) {
          process.send({
            error: error,
            png: png,
            dsm: dsmTmp,
            request: message,
            env: process.env
          });
        }
      });
    });
  });
});
