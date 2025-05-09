import express from 'express';
import { Request, Response } from 'express';
import { client, register } from '../services/prometheusMetricsService';

const router = express.Router();

/**
 * Route handler for receiving frontend metrics
 */
router.post('/frontend', async (req: Request, res: Response) => {
  try {
    const metrics = req.body;
    
    if (!Array.isArray(metrics)) {
      return res.status(400).json({ error: 'Invalid metrics format' });
    }
    
    // Process each metric
    metrics.forEach((metric) => {
      switch (metric.type) {
        case 'web_vital':
          processWebVital(metric);
          break;
          
        case 'component_render':
          processComponentRender(metric);
          break;
          
        case 'page_load':
          processPageLoad(metric);
          break;
          
        case 'api_request':
          processApiRequest(metric);
          break;
          
        default:
          // Ignore unknown metric types
          break;
      }
    });
    
    // Return success
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error processing metrics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Process Web Vitals metrics
 */
function processWebVital(metric: any) {
  const { name, value } = metric;
  
  switch (name) {
    case 'CLS':
      client.observe('web_vitals_cls', value);
      break;
      
    case 'FCP':
      client.observe('web_vitals_fcp', value);
      break;
      
    case 'LCP':
      client.observe('web_vitals_lcp', value);
      break;
      
    case 'FID':
      client.observe('web_vitals_fid', value);
      break;
      
    case 'TTFB':
      client.observe('web_vitals_ttfb', value);
      break;
  }
}

/**
 * Process component render time metrics
 */
function processComponentRender(metric: any) {
  const { component, value, count } = metric;
  
  client.observe('frontend_component_render_time', value, { component });
  client.inc('frontend_component_render_count', count, { component });
}

/**
 * Process page load time metrics
 */
function processPageLoad(metric: any) {
  const { page, value, count } = metric;
  
  client.observe('frontend_page_load_time', value, { page });
  client.inc('frontend_page_load_count', count, { page });
}

/**
 * Process API request metrics
 */
function processApiRequest(metric: any) {
  const { endpoint, value, count, successRate } = metric;
  
  client.observe('frontend_api_request_duration', value, { endpoint });
  client.inc('frontend_api_request_count', count, { endpoint });
  client.set('frontend_api_success_rate', successRate, { endpoint });
}

/**
 * Route handler for exposing Prometheus metrics
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const metrics = await register.metrics();
    res.set('Content-Type', register.contentType);
    res.end(metrics);
  } catch (error) {
    console.error('Error generating metrics:', error);
    res.status(500).send('Internal Server Error');
  }
});

export default router;