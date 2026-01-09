@echo off
doskey login=cf login --sso -a https://api.cf.ap12.hana.ondemand.com
doskey push-dev=cf push -f manifest-dev.yml
doskey push-prd=cf push -f manifest-prd.yml --strategy rolling
doskey status=cf app ear-prd
doskey build=npm run build
doskey target-dev=cf target -o "SK C & C Co Ltd_ear-dev-sf98y10l"
doskey target-prd=cf target -o "SK C & C Co Ltd_ear-prd"
