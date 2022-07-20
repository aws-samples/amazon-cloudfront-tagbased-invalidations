.PHONY: clean package prepare deploy

# give a name, version of the deployment. Used as stack name
project_name = tag-invalidation
version = v15
stack_name = $(project_name)-$(version)

# s3 bucket to hold the build artifacts
bucket = <ENTER>

# region to deploy. Always us-east-1 for Lambda@Edge and CloudFront functions deployment
# regions = us-east-1 ap-south-1 eu-central-1 ap-southeast-2
# regions = us-east-2 eu-central-1
region = <ENTER>
# acl = public-read
 acl = private
# the AWS CLI profile which has necesary permissions for the deployment
profile = <ENTER>
# profile = <ENTER>
backend_endpoint = <ENTER>

all: clean createbucket package prepare deploy

createbucket:
	aws s3api create-bucket --bucket $(bucket)-us-east-1 --region us-east-1
	aws s3api create-bucket --bucket $(bucket)-$(region) --region $(region) --create-bucket-configuration LocationConstraint=$(region)

package:
	mkdir -p dist && cd lambda-functions/origin-response && zip -FS -q -r ../../dist/origin-response.zip * && cd ../../
	mkdir -p dist && cd lambda-functions/tag-ingest-table && zip -FS -q -r ../../dist/tag-ingest-table.zip * && cd ../../
	mkdir -p dist && cd lambda-functions/tag-purger && zip -FS -q -r ../../dist/tag-purger.zip * && cd ../../

	aws s3 cp dist/origin-response.zip s3://$(bucket)-us-east-1/$(project_name)/$(version)/code/ --acl $(acl) --profile $(profile); \
	aws s3 cp dist/tag-ingest-table.zip s3://$(bucket)-$(region)/$(project_name)/$(version)/code/ --acl $(acl) --profile $(profile); \
	aws s3 cp dist/tag-purger.zip s3://$(bucket)-$(region)/$(project_name)/$(version)/code/ --acl $(acl) --profile $(profile); \

prepare:
	sed -e "s/SOURCEBUCKET/${bucket}-${region}/g" -e "s|VERSION|${version}|g" -e "s|PROJECTNAME|${project_name}|g" templates/template.yml > template-deploy.yml
	aws cloudformation package --template-file template-deploy.yml --s3-bucket $(bucket)-$(region) --s3-prefix $(project_name)/$(version)/code --output-template-file dist/template.yml --profile $(profile); \
	aws s3 cp dist/template.yml s3://$(bucket)-$(region)/$(project_name)/$(version)/templates/template.yml --acl $(acl) --profile $(profile)
	rm -rf template-deploy.yml

deploy:
	aws cloudformation deploy --template-file dist/template.yml --s3-bucket $(bucket)-$(region) \
	--stack-name $(stack_name) --capabilities=CAPABILITY_NAMED_IAM --profile $(profile) --region $(region) \
	--parameter-overrides \
	BackendEndpoint=$(backend_endpoint)

clean:
	rm -rf lambda-functions/origin-response/node_modules
	rm -rf lambda-functions/origin-response/package*.json
	rm -rf dist
