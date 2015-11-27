rm -rf bundle.zip
aws s3 rm s3://lambda-drone/bundle.zip
zip -9 bundle.zip index.js
zip -9 bundle.zip worker.js
zip -9 bundle.zip config.json
zip -9 bundle.zip gdal.sh
mv local/lib local/lib.real
mv local/lib.new local/lib
mv local/bin local/bin.real
mv local/bin.new local/bin
zip -r9 bundle.zip local/lib
zip -r9 bundle.zip local/bin
mv local/lib local/lib.new
mv local/bin local/bin.new
mv local/lib.real local/lib
mv local/bin.real local/bin
zip -r9 bundle.zip local/share/gdal
zip -r9 bundle.zip node_modules
cd $VIRTUAL_ENV/lib64/python2.7/site-packages
zip -r9 ~/lambda/bundle.zip *
cd $VIRTUAL_ENV/lib/python2.7/site-packages
zip -r9 ~/lambda/bundle.zip *
cd ~/lambda
aws s3 cp ./bundle.zip s3://lambda-drone --acl public-read
aws lambda update-function-code --function-name tileTest --s3-bucket lambda-drone --s3-key bundle.zip --publish
aws lambda invoke --invocation-type Event --function-name tileTest --region us-west-2 --payload file:///home/ec2-user/lambda/test-event.json --profile default outputfile.txt
