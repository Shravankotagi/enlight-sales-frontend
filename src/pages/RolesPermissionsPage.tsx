import { RolePermissionsMatrixModal } from '../components/RolePermissionsMatrixModal';

export default function RolesPermissionsPage() {
  return (
    <div className="space-y-6 pb-12 min-w-0">
      <RolePermissionsMatrixModal asPage isOpen onClose={() => {}} />
    </div>
  );
}
