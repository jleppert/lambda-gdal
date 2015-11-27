var child_process = require('child_process'),
    path = require('path'),
    cwd  = path.dirname(require.main.filename);

exports.tile = function(event, context) {
  console.log('started tile!!');
  console.log('current path is', cwd);
  console.log(path.resolve(cwd, 'local', 'lib'));    
  var rootPath = process.env['LAMBDA_TASK_ROOT'] || cwd;
  console.log("root path", rootPath);
  var currentPath = process.env['PATH'];

  var worker = child_process.fork('./worker.js', { env: { TASK_ROOT: rootPath, PATH: currentPath + ':' + path.resolve(rootPath, 'local', 'bin'), LD_LIBRARY_PATH: path.resolve(rootPath, 'local', 'lib') }});

  worker.on('message', function(m) {
    console.log('got message!');
    console.log(JSON.stringify(m));
    
    if(m.error !== undefined) {
      context.fail(m);
      worker.kill();
      context.done();
    } else {
      context.succeed(m);
      worker.kill();
      context.done();
    } 
  });
  
  worker.send({
    dsm: {
      bucket: 'kespry-files',
      key: 'images/2300/products/dsm.tif'
    },
    zoom: '18-22'
  });
  //worker.send(event);
};
