require('dotenv').config()

const exec = require('child_process').exec
const path = require('path')

deployApp()
  .then(() => {
    console.log('Deployed') // eslint-disable-line no-console
  })
  .catch((error) => {
    console.log(error.message) // eslint-disable-line no-console
    process.exit(1)
  })

function deployApp() {
  return new Promise((resolve, reject) => {
    console.log('Deploying app') // eslint-disable-line no-console
    const deployUrl = process.env.DEPLOY_URL || null
    if (!deployUrl || deployUrl.length === 0) {
      return reject(new Error('DEPLOY_URL env var not found'))
    }
    const deployCommand = [
      'rsync',
      '--recursive',
      '--checksum',
      '--verbose',
      '--times',
      '--delete',
      '--chmod=u=rwX,g=rX',
      '--exclude=.DS_Store',
      path.join(__dirname, '..', '.dist') + '/',
      deployUrl,
    ].join(' ')
    exec(deployCommand, (error, stdout) => {
      if (error) {
        return reject(error)
      }
      console.log(stdout) // eslint-disable-line no-console
      resolve()
    })
  })
}
