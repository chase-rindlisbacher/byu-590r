// Same-origin /api/ — Apache on :443 proxies to Laravel on :4444 (avoids mixed content when SPA is HTTPS)
// deployHost: __EC2_HOST__ replaced at deploy from GitHub Actions secret EC2_HOST
export const environment = {
  production: true,
  apiUrl: '/api/',
  deployHost: '__EC2_HOST__',
};
