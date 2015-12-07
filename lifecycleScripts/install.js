var promisify = require("promisify-node");
var path = require("path");
var fs = require("fs");

var prepareForBuild = require("./prepareForBuild");

var exec = promisify(function(command, opts, callback) {
  return require("child_process").exec(command, opts, callback);
});

var local = path.join.bind(path, __dirname);

if (fs.existsSync(local("../.didntcomefromthenpmregistry"))) {
  return prepareAndBuild();
}
if (process.env.BUILD_DEBUG) {
  console.info("[nodegit] Doing a debug build, no fetching allowed.");
  return prepareAndBuild();
}
if (process.env.BUILD_ONLY) {
  console.info("[nodegit] BUILD_ONLY is set to true, no fetching allowed.");
  return prepareAndBuild();
}

return installPrebuilt();

function installPrebuilt() {
  console.info("[nodegit] Fetching binary from S3.");
  return exec("node-pre-gyp install --fallback-to-build=false")
    .then(
      function() {
        console.info("[nodegit] Completed installation successfully.");
      },
      function(err) {
        console.info("[nodegit] Failed to install prebuilt binary, " +
          "building manually.");
        console.error(err);
        return prepareAndBuild();
      }
    );
}


function prepareAndBuild() {
  console.info("[nodegit] Regenerating and configuring code");
  return prepareForBuild()
    .then(function() {
      return build();
    });
}

function build() {
  console.info("[nodegit] Everything is ready to go, attempting compilation");

  var opts = {
    cwd: ".",
    maxBuffer: Number.MAX_VALUE,
    env: process.env
  };

  var debug = (process.env.BUILD_DEBUG ? " --debug" : "");
  var builder = "node-gyp";

  var home = process.platform == "win32" ?
              process.env.USERPROFILE : process.env.HOME;

  opts.env.HOME = path.join(home, ".nodegit-gyp");

  builder = path.resolve(".", "node_modules", ".bin", builder);
  builder = builder.replace(/\s/g, "\\$&");
  var cmd = [builder, "rebuild", debug].join(" ").trim();

  return exec(cmd, opts)
    .then(function() {
        console.info("[nodegit] Compilation complete.");
        console.info("[nodegit] Completed installation successfully.");
        process.exitCode = 0;
      },
      function(err, stderr) {
        console.error(err);
        console.error(stderr);
        process.exitCode = 13;
      }
    );
}
