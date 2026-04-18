import { useStore } from './store';
import { useListFarms } from '@workspace/api-client-react';

export type FarmPermissions = {
  can_view_animals: boolean;
  can_add_animals: boolean;
  can_edit_animals: boolean;
  can_remove_animals: boolean;
  can_view_inventory: boolean;
  can_add_inventory: boolean;
  can_edit_inventory: boolean;
  can_remove_inventory: boolean;
  can_view_finances: boolean;
  can_add_finances: boolean;
  can_edit_finances: boolean;
  can_remove_finances: boolean;
  can_view_contacts: boolean;
  can_add_contacts: boolean;
  can_edit_contacts: boolean;
  can_remove_contacts: boolean;
  can_view_employees: boolean;
  can_add_employees: boolean;
  can_edit_employees: boolean;
  can_remove_employees: boolean;
  can_view_calendar: boolean;
  can_add_calendar: boolean;
  can_edit_calendar: boolean;
  can_remove_calendar: boolean;
};

const ALL_TRUE: FarmPermissions = {
  can_view_animals: true, can_add_animals: true, can_edit_animals: true, can_remove_animals: true,
  can_view_inventory: true, can_add_inventory: true, can_edit_inventory: true, can_remove_inventory: true,
  can_view_finances: true, can_add_finances: true, can_edit_finances: true, can_remove_finances: true,
  can_view_contacts: true, can_add_contacts: true, can_edit_contacts: true, can_remove_contacts: true,
  can_view_employees: true, can_add_employees: true, can_edit_employees: true, can_remove_employees: true,
  can_view_calendar: true, can_add_calendar: true, can_edit_calendar: true, can_remove_calendar: true,
};

const ALL_FALSE: FarmPermissions = {
  can_view_animals: false, can_add_animals: false, can_edit_animals: false, can_remove_animals: false,
  can_view_inventory: false, can_add_inventory: false, can_edit_inventory: false, can_remove_inventory: false,
  can_view_finances: false, can_add_finances: false, can_edit_finances: false, can_remove_finances: false,
  can_view_contacts: false, can_add_contacts: false, can_edit_contacts: false, can_remove_contacts: false,
  can_view_employees: false, can_add_employees: false, can_edit_employees: false, can_remove_employees: false,
  can_view_calendar: false, can_add_calendar: false, can_edit_calendar: false, can_remove_calendar: false,
};

type FarmWithMembership = {
  id: string;
  userRole?: string;
  userPermissions?: Partial<FarmPermissions>;
  [key: string]: unknown;
};

export function useFarmPermissions() {
  const { activeFarmId } = useStore();
  const { data: farms, isLoading: farmsLoading } = useListFarms();

  const farm = (farms as FarmWithMembership[] | undefined)?.find(f => f.id === activeFarmId);
  const isOwner = farm?.userRole === 'owner';
  const farmsLoaded = !farmsLoading && farms !== undefined;

  const permissions: FarmPermissions = isOwner
    ? ALL_TRUE
    : farm?.userPermissions
      ? { ...ALL_FALSE, ...(farm.userPermissions as FarmPermissions) }
      : ALL_FALSE;

  return {
    isOwner,
    farmsLoaded,
    permissions,
    can: (perm: keyof FarmPermissions) => isOwner || permissions[perm] === true,
  };
}
