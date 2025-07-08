const axios = require('axios');

const API_URL = 'http://localhost:5001/api';

// Test credentials
const testUser = {
  email: 'test@example.com',
  password: 'TestPassword123!'
};

let authToken = null;
let createdProjectId = null;
let duplicatedProjectId = null;

async function login() {
  try {
    console.log('🔐 Logging in...');
    const response = await axios.post(`${API_URL}/auth/login`, testUser);
    authToken = response.data.token || response.data.accessToken || response.data.access_token;
    if (!authToken && response.data.tokens) {
      authToken = response.data.tokens.accessToken || response.data.tokens.access_token;
    }
    console.log('✅ Logged in successfully');
    return authToken;
  } catch (error) {
    console.error('❌ Login error:', error.response?.data || error.message);
    throw error;
  }
}

async function createProject() {
  try {
    console.log('\n📁 Creating project...');
    const response = await axios.post(`${API_URL}/projects`, {
      title: `Test Project ${Date.now()}`,
      description: 'This is a test project'
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    createdProjectId = response.data.id;
    console.log('✅ Project created:', createdProjectId);
    return response.data;
  } catch (error) {
    console.error('❌ Create project error:', error.response?.data || error.message);
    throw error;
  }
}

async function duplicateProject() {
  try {
    console.log('\n📋 Duplicating project...');
    const response = await axios.post(`${API_URL}/projects/${createdProjectId}/duplicate`, {
      newTitle: `Duplicated Project ${Date.now()}`,
      copyFiles: true,
      copySegmentations: false
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    duplicatedProjectId = response.data.id || response.data.taskId;
    console.log('✅ Project duplicated:', duplicatedProjectId);
    return response.data;
  } catch (error) {
    console.error('❌ Duplicate project error:', error.response?.data || error.message);
    throw error;
  }
}

async function shareProject() {
  try {
    console.log('\n🔗 Sharing project via email...');
    const response = await axios.post(`${API_URL}/project-shares/${createdProjectId}`, {
      email: 'shared@example.com',
      permission: 'view'
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    console.log('✅ Project shared successfully');
    console.log('Share response:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Share project error:', error.response?.data || error.message);
    throw error;
  }
}

async function generateInvitationLink() {
  try {
    console.log('\n🎫 Generating invitation link...');
    const response = await axios.post(`${API_URL}/project-shares/${createdProjectId}/invitation-link`, {
      permission: 'edit'
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    console.log('✅ Invitation link generated:', response.data.data?.invitationUrl || response.data.invitationUrl);
    return response.data;
  } catch (error) {
    console.error('❌ Generate invitation link error:', error.response?.data || error.message);
    throw error;
  }
}

async function deleteProject(projectId) {
  try {
    console.log(`\n🗑️  Deleting project ${projectId}...`);
    await axios.delete(`${API_URL}/projects/${projectId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    console.log('✅ Project deleted successfully');
  } catch (error) {
    console.error('❌ Delete project error:', error.response?.data || error.message);
    throw error;
  }
}

async function listProjects() {
  try {
    console.log('\n📋 Listing projects...');
    const response = await axios.get(`${API_URL}/projects`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    console.log(`✅ Found ${response.data.total || response.data.projects?.length || 0} projects`);
    const projects = response.data.projects || response.data.data || [];
    projects.forEach(p => {
      console.log(`  - ${p.id}: ${p.title}`);
    });
    return response.data;
  } catch (error) {
    console.error('❌ List projects error:', error.response?.data || error.message);
    throw error;
  }
}

async function checkEmailService() {
  try {
    console.log('\n📧 Checking email service configuration...');
    const response = await axios.get(`${API_URL}/health`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    console.log('✅ Health check response:', response.data);
  } catch (error) {
    console.log('⚠️  Health check error (non-critical):', error.message);
  }
}

async function runTests() {
  try {
    console.log('🚀 Starting project feature tests...\n');
    
    // Login
    await login();
    
    // Check email service
    await checkEmailService();
    
    // Create project
    await createProject();
    
    // List projects
    await listProjects();
    
    // Share project via email
    await shareProject();
    
    // Generate invitation link
    await generateInvitationLink();
    
    // Duplicate project
    await duplicateProject();
    
    // List projects again
    await listProjects();
    
    // Delete projects
    if (createdProjectId) {
      await deleteProject(createdProjectId);
    }
    if (duplicatedProjectId && duplicatedProjectId !== createdProjectId) {
      await deleteProject(duplicatedProjectId);
    }
    
    // List projects final
    await listProjects();
    
    console.log('\n✅ All tests completed successfully!');
    console.log('\n📧 Email sharing is already implemented in the backend.');
    console.log('   - Emails are sent from spheroseg@utia.cas.cz');
    console.log('   - Invitation links include project invitation tokens');
    console.log('   - Recipients can accept invitations to access shared projects');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run tests
runTests();