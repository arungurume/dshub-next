const axios = require('axios');
axios.get('http://localhost:9002/cms/api/v2/sac/plan-config/pricing')
  .then(res => console.log("SUCCESS:", res.data))
  .catch(err => console.log("ERROR:", err.response ? err.response.data : err.message));
