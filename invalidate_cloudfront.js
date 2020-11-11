const AWS = require("aws-sdk")
const config = require("./dist_server/server/config").config

const CLOUDFRONT_ID = config.aws.cloud_front.id
const AWS_REGION = config.aws.region
const AWS_ACCESS_KEY_ID = config.aws.access_key_id
const AWS_SECRET_ACCESS_KEY = config.aws.secret_access_key

AWS.config.update({
  accessKeyId: AWS_ACCESS_KEY_ID,
  secretAccessKey: AWS_SECRET_ACCESS_KEY,
  region: AWS_REGION,
})

const cloudfront = new AWS.CloudFront({
  apiVersion: "2017-03-25",
})

async function invalidateCloudFront() {
  const invalidate_items = ["/*"]

  if (CLOUDFRONT_ID && config.aws.s3.via_cdn) {
    const params = {
      DistributionId: CLOUDFRONT_ID,
      InvalidationBatch: {
        CallerReference: String(new Date().getTime()),
        Paths: {
          Quantity: invalidate_items.length,
          Items: invalidate_items,
        },
      },
    }
    const data1 = await cloudfront.createInvalidation(params).promise()
    console.log(data1)
  }

  console.log("Invalidated", invalidate_items)
  return true
}

invalidateCloudFront()
  .then(r => {
    console.log("Result", r)
  })
  .catch(e => {
    console.error(e)
  })
