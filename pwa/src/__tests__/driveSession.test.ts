// @vitest-environment jsdom
/**
 * Drive connection lifecycle: the persisted `driveConnected` intent must
 * survive token expiry (so the connection can be silently re-granted) but be
 * dropped on an explicit disconnect.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useStore, getValidDriveToken } from '../store/useStore'

describe('Drive connection lifecycle', () => {
  beforeEach(() => {
    useStore.getState().disconnectDrive()
  })

  it('obtaining a token marks the connection live', () => {
    useStore.getState().setDriveToken('tok-123', 3600)
    const s = useStore.getState()
    expect(s.driveToken).toBe('tok-123')
    expect(s.driveConnected).toBe(true)
    expect(getValidDriveToken(s)).toBe('tok-123')
  })

  it('clearing an expired token keeps the connected intent (for silent re-grant)', () => {
    useStore.getState().setDriveToken('tok-123', 3600)
    useStore.getState().setDriveToken(null)
    const s = useStore.getState()
    expect(s.driveToken).toBeNull()
    expect(s.driveConnected).toBe(true)
    expect(getValidDriveToken(s)).toBeNull()
  })

  it('explicit disconnect drops both the token and the intent', () => {
    useStore.getState().setDriveToken('tok-123', 3600)
    useStore.getState().disconnectDrive()
    const s = useStore.getState()
    expect(s.driveToken).toBeNull()
    expect(s.driveConnected).toBe(false)
  })

  it('a token within 60s of its expiry is treated as invalid', () => {
    useStore.setState({ driveToken: 'old', driveTokenExpiresAt: Date.now() + 30_000 })
    expect(getValidDriveToken(useStore.getState())).toBeNull()
  })
})
