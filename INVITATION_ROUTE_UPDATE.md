# Invitation Route Update

## Summary
Added support for shorter invitation URLs using `/invitation/:token` instead of `/accept-invitation/:token`.

## Changes Made

### Frontend (App.tsx)
- Added new route `/invitation/:token` that uses the same `AcceptInvitation` component
- Kept the existing `/accept-invitation/:token` route for backward compatibility
- Both routes now work and lead to the same invitation acceptance page

### Backend
1. **projectShareController.ts**
   - Updated `generateInvitationLink` function to generate URLs with `/invitation/:token` format
   
2. **emailService.ts**
   - Updated invitation email link generation to use `/invitation/:token` format

## URL Format
- Old format: `https://spherosegapp.utia.cas.cz/accept-invitation/{token}`
- New format: `https://spherosegapp.utia.cas.cz/invitation/{token}`

## Testing
Both URL formats will work:
1. `/invitation/{token}` - New shorter format
2. `/accept-invitation/{token}` - Legacy format (still supported)

## Backend API
The API endpoint remains unchanged: `POST /api/project-shares/invitation/:token`