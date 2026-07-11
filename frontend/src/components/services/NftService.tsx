import { useNavigate, useParams } from '@tanstack/react-router';
import CollectionCreate from '../../services/nft/CollectionCreate';
import CollectionDashboard from '../../services/nft/CollectionDashboard';

function readAccessToken() {
  try {
    const session = JSON.parse(localStorage.getItem('zexvro_user_session') || '{}') as {
      token?: unknown;
    };
    return typeof session.token === 'string' ? session.token : '';
  } catch {
    return '';
  }
}

function useNftRouteContext() {
  const { workspaceId, projectId } = useParams({ strict: false });
  if (!workspaceId || !projectId) {
    throw new Error('NFT routes require a workspace and project');
  }
  return {
    workspaceId,
    projectId,
    storageScope: `${workspaceId}:${projectId}`,
    accessToken: readAccessToken(),
  };
}

export default function NftService() {
  const navigate = useNavigate();
  const context = useNftRouteContext();

  return (
    <CollectionDashboard
      workspaceId={context.storageScope}
      accessToken={context.accessToken}
      onCreate={() => navigate({
        to: '/dashboard/w/$workspaceId/p/$projectId/nft/collections/new',
        params: {
          workspaceId: context.workspaceId,
          projectId: context.projectId,
        },
      })}
    />
  );
}

export function NftCollectionCreate() {
  const navigate = useNavigate();
  const context = useNftRouteContext();

  return (
    <CollectionCreate
      workspaceId={context.storageScope}
      accessToken={context.accessToken}
      onClose={() => navigate({
        to: '/dashboard/w/$workspaceId/p/$projectId/nft',
        params: {
          workspaceId: context.workspaceId,
          projectId: context.projectId,
        },
        replace: true,
      })}
    />
  );
}
