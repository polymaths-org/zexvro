import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { CircleAlert } from 'lucide-react';
import {
  ensureValidAccessToken,
  readStoredSession,
} from '../../auth/cognito';
import SectionSkeleton from '../ui/SectionSkeleton';
import CollectionCreate from '../../services/nft/CollectionCreate';
import CollectionList from '../../services/nft/CollectionList';
import CollectionStudio from '../../services/nft/CollectionStudio';

function useNftRouteContext() {
  const { workspaceId, projectId, collectionId } = useParams({ strict: false });
  if (!workspaceId || !projectId) {
    throw new Error('NFT routes require a workspace and project');
  }
  return {
    workspaceId,
    projectId,
    collectionId: typeof collectionId === 'string' ? collectionId : undefined,
    storageScope: `${workspaceId}:${projectId}`,
  };
}

/** Resolve a fresh Cognito access token (refresh if expired). */
function useNftAccessToken() {
  const [accessToken, setAccessToken] = useState(() => readStoredSession()?.token || '');
  const [authError, setAuthError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setAuthError('');
    void ensureValidAccessToken()
      .then((token) => {
        if (!cancelled) {
          setAccessToken(token);
          setReady(true);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setAccessToken('');
          setAuthError(error instanceof Error ? error.message : 'Sign in required');
          setReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { accessToken, authError, ready };
}

function NftAuthGate({ children }: { children: (accessToken: string) => ReactNode }) {
  const { accessToken, authError, ready } = useNftAccessToken();

  if (!ready) {
    return <SectionSkeleton rows={3} label="Checking session" />;
  }

  if (!accessToken || authError) {
    return (
      <div className="mx-auto max-w-lg rounded-md border border-red-500/25 bg-red-500/5 px-4 py-3 text-sm text-red-600 dark:text-red-400">
        <div className="flex items-start gap-2">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">NFT API authentication failed</p>
            <p className="mt-1 text-red-600/80 dark:text-red-400/80">
              {authError || 'A valid access token is required. Sign out and sign in again.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children(accessToken)}</>;
}

export default function NftService() {
  const navigate = useNavigate();
  const context = useNftRouteContext();

  return (
    <NftAuthGate>
      {(accessToken) => (
        <CollectionList
          workspaceId={context.storageScope}
          accessToken={accessToken}
          onCreate={() => navigate({
            to: '/dashboard/w/$workspaceId/p/$projectId/nft/collections/new',
            params: {
              workspaceId: context.workspaceId,
              projectId: context.projectId,
            },
          })}
          onOpenDashboard={(collectionId) => navigate({
            to: '/dashboard/w/$workspaceId/p/$projectId/nft/collections/$collectionId',
            params: {
              workspaceId: context.workspaceId,
              projectId: context.projectId,
              collectionId,
            },
          })}
        />
      )}
    </NftAuthGate>
  );
}

export function NftCollectionCreate() {
  const navigate = useNavigate();
  const context = useNftRouteContext();

  return (
    <NftAuthGate>
      {(accessToken) => (
        <CollectionCreate
          workspaceId={context.storageScope}
          accessToken={accessToken}
          onClose={() => navigate({
            to: '/dashboard/w/$workspaceId/p/$projectId/nft',
            params: {
              workspaceId: context.workspaceId,
              projectId: context.projectId,
            },
            replace: true,
          })}
          onCreated={(collection) => navigate({
            to: '/dashboard/w/$workspaceId/p/$projectId/nft/collections/$collectionId',
            params: {
              workspaceId: context.workspaceId,
              projectId: context.projectId,
              collectionId: collection.id,
            },
            replace: true,
          })}
        />
      )}
    </NftAuthGate>
  );
}

export function NftCollectionStudio() {
  const navigate = useNavigate();
  const context = useNftRouteContext();
  if (!context.collectionId) {
    throw new Error('Collection studio requires a collection id');
  }

  return (
    <NftAuthGate>
      {(accessToken) => (
        <CollectionStudio
          workspaceId={context.storageScope}
          accessToken={accessToken}
          collectionId={context.collectionId!}
          onBack={() => navigate({
            to: '/dashboard/w/$workspaceId/p/$projectId/nft',
            params: {
              workspaceId: context.workspaceId,
              projectId: context.projectId,
            },
          })}
        />
      )}
    </NftAuthGate>
  );
}
