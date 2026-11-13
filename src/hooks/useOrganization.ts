/**
 * Organization of the logged-in coach (phase 3 of the organization layer): name, members, open
 * invites, and the owner actions. Every change goes through a database function that checks the
 * caller is the owner — the app never writes the organization tables directly.
 *
 * status 'unavailable': the organization SQL hasn't run yet, or this account has no organization.
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

export type OrgRole = 'owner' | 'coach' | 'intern';

export interface OrgMember {
  userId: string;
  email: string;
  name: string | null;
  role: OrgRole;
  joinedAt: string;
}

export interface OrgInvite {
  id: string;
  email: string;
  role: Exclude<OrgRole, 'owner'>;
  code: string;
  createdAt: string;
  expiresAt: string;
}

interface MemberRow { user_id: string; email: string | null; name: string | null; role: OrgRole; joined_at: string }
interface InviteRow { id: string; email: string; role: Exclude<OrgRole, 'owner'>; code: string; created_at: string; expires_at: string }

/** The short key the database functions raise (e.g. 'last_owner'), or the plain message */
export function orgErrorKey(err: unknown): string {
  const msg = (err as { message?: string } | null)?.message ?? '';
  return /^[a-z_]+$/.test(msg) ? msg : 'unknown';
}

export function inviteLink(code: string): string {
  return `${window.location.origin}/join?code=${encodeURIComponent(code)}`;
}

export function useOrganization() {
  const { user } = useAuth();
  const [status, setStatus] = useState<'loading' | 'unavailable' | 'ready'>('loading');
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgName, setOrgName] = useState('');
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [invites, setInvites] = useState<OrgInvite[]>([]);

  const myRole: OrgRole | null = members.find((m) => m.userId === user?.id)?.role ?? null;
  const isOwner = myRole === 'owner';

  const load = useCallback(async () => {
    if (!user) return;
    const { data: memberRows, error: memberErr } = await supabase.rpc('get_org_members');
    const rows = (memberRows ?? []) as MemberRow[];
    if (memberErr || rows.length === 0) {
      if (memberErr) console.warn('[useOrganization] members', memberErr.message);
      setStatus('unavailable');
      return;
    }
    const { data: org } = await supabase.from('organizations').select('id, name').maybeSingle();
    const { data: inviteRows } = await supabase
      .from('organization_invites')
      .select('id, email, role, code, created_at, expires_at')
      .is('accepted_at', null)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    setMembers(rows.map((r) => ({
      userId: r.user_id, email: r.email ?? '', name: r.name, role: r.role, joinedAt: r.joined_at,
    })));
    setOrgId((org as { id: string } | null)?.id ?? null);
    setOrgName((org as { name: string } | null)?.name ?? '');
    setInvites(((inviteRows ?? []) as InviteRow[]).map((r) => ({
      id: r.id, email: r.email, role: r.role, code: r.code, createdAt: r.created_at, expiresAt: r.expires_at,
    })));
    setStatus('ready');
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  /** Runs an owner action, reloads, and throws the error key on failure */
  const run = useCallback(async (fn: string, args: Record<string, unknown>) => {
    const { data, error } = await supabase.rpc(fn, args);
    if (error) throw new Error(orgErrorKey(error));
    await load();
    return data as unknown;
  }, [load]);

  const rename = useCallback((name: string) => run('rename_org', { p_name: name }), [run]);
  const revokeInvite = useCallback((id: string) => run('revoke_org_invite', { p_id: id }), [run]);
  const setRole = useCallback((userId: string, role: OrgRole) => run('set_org_member_role', { p_user: userId, p_role: role }), [run]);
  const removeMember = useCallback((userId: string) => run('remove_org_member', { p_user: userId }), [run]);
  const createInvite = useCallback(async (email: string, role: Exclude<OrgRole, 'owner'>): Promise<string> => {
    const data = await run('create_org_invite', { p_email: email, p_role: role });
    const row = (Array.isArray(data) ? data[0] : data) as { code?: string } | null;
    if (!row?.code) throw new Error('unknown');
    return row.code;
  }, [run]);

  return { status, orgId, orgName, members, invites, myRole, isOwner, reload: load, rename, createInvite, revokeInvite, setRole, removeMember };
}
