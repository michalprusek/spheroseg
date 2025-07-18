# Architecture Issues Quick Reference

## 🔴 CRITICAL - Fix Immediately

### 1. SQL Injection Vulnerabilities
```sql
-- CURRENT (VULNERABLE)
query = `SELECT * FROM images WHERE project_id = ${projectId}`

-- MUST CHANGE TO
query = 'SELECT * FROM images WHERE project_id = $1'
await db.query(query, [projectId])
```

### 2. Rate Limiting Missing
- Causing 429 errors in production
- No protection against DDoS
- Fix: Add express-rate-limit middleware

### 3. Failing Test Suite
- 369 tests failing out of 1059
- No confidence in deployments
- Technical debt accumulating

## 🟠 HIGH - Fix This Sprint

### 1. Synchronous ML Processing
- Blocks entire system during segmentation
- No horizontal scaling
- Users experience timeouts
- Solution: Implement job queue (Bull/Redis)

### 2. Database Performance
- No connection pooling
- Raw SQL everywhere
- Missing indexes
- N+1 query problems

### 3. Frontend State Chaos
- React Context + Local State + WebSocket
- State synchronization issues
- Race conditions
- Memory leaks

## 🟡 MEDIUM - Fix This Quarter

### 1. No Monitoring
- Flying blind in production
- No error tracking
- No performance metrics
- Can't debug issues

### 2. Docker/Deployment Issues
- 1GB+ images
- No health checks
- No rollback strategy
- Manual deployments

### 3. API Design Flaws
- No versioning
- Inconsistent responses
- Missing documentation
- No contract testing

## Architecture Smells

### Tight Coupling
- Frontend knows database schema
- Services call each other directly
- No abstraction layers
- Hard to change anything

### Missing Abstractions
- No repository pattern
- No service layer
- Business logic in controllers
- SQL in route handlers

### Poor Error Handling
- Errors swallowed silently
- Inconsistent error formats
- No error recovery
- User sees generic messages

## Quick Wins (< 1 Day Each)

1. **Add Rate Limiting**
   ```javascript
   npm install express-rate-limit
   app.use(rateLimit({ windowMs: 15*60*1000, max: 100 }))
   ```

2. **Fix SQL Injection**
   - Use parameterized queries
   - ~50 queries to fix
   - Critical security issue

3. **Add Database Indexes**
   ```sql
   CREATE INDEX idx_images_project_id ON images(project_id);
   CREATE INDEX idx_cells_image_id ON cells(image_id);
   ```

4. **Enable Connection Pooling**
   ```javascript
   const pool = new Pool({
     connectionString: DATABASE_URL,
     max: 20,
     idleTimeoutMillis: 30000
   });
   ```

5. **Add Basic Monitoring**
   - Install Sentry for errors
   - Add winston for logging
   - Track response times

## Red Flags for New Developers

1. **Don't add more raw SQL** - We're moving away from this
2. **Don't add to utils folders** - They're already too large
3. **Don't disable more tests** - Fix them instead
4. **Don't add more polling** - Use WebSocket or job queues
5. **Don't store secrets in code** - Use environment variables

## Migration Priorities

1. **Week 1**: Security fixes (SQL injection, rate limiting)
2. **Week 2**: Add job queue for ML processing
3. **Week 3**: Fix test suite
4. **Week 4**: Add monitoring
5. **Month 2**: Database optimization
6. **Month 3**: Frontend refactoring

## Success Metrics

- Zero SQL injection vulnerabilities
- < 10 failing tests
- < 200ms API response time
- Zero 429 errors
- 99.9% uptime