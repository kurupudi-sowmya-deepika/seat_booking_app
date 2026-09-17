import type { LayoutItem } from '../components/floorplan/FloorPlanCanvas';

export interface GeneratedRoomSpec {
  name: string;
  room_number: string;
  capacity: number;
  shape: 'RECTANGLE' | 'SQUARE' | 'CIRCLE' | 'OVAL';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  amenities: string[];
  door_side: 'NORTH' | 'SOUTH' | 'EAST' | 'WEST';
  has_window: boolean;
}

export interface GenerateRoomsRequest {
  meeting_room_count?: number | null;
  conference_room_count?: number | null;
  available_area_sqft?: number | null;
  capacity_min?: number | null;
  capacity_max?: number | null;
  required_amenities?: string[] | null;
  style?: string | null;
  nl_request?: string | null;
  pending_rooms?: GeneratedRoomSpec[] | null;
  regenerate_room_name?: string | null;
}

export interface ProposedRoomBundle {
  spec: GeneratedRoomSpec;
  room: LayoutItem;
  children: LayoutItem[];
}

export interface GenerationValidationIssue {
  item_id?: string | null;
  message: string;
  severity: 'error' | 'warning';
}

export interface GenerateRoomsResponse {
  rooms: ProposedRoomBundle[];
  issues: GenerationValidationIssue[];
  notes?: string | null;
}

/** Flattens a proposal's room + children items into one flat LayoutItem list,
 * ready to be spliced into the editor's `items` array. */
export function flattenProposal(response: GenerateRoomsResponse | null): LayoutItem[] {
  if (!response) return [];
  return response.rooms.flatMap((bundle) => [bundle.room, ...bundle.children]);
}

/** All item ids (room + children) belonging to a proposal, for the canvas's
 * `proposedItemIds` dashed-outline treatment. */
export function proposalItemIds(response: GenerateRoomsResponse | null): Set<string> {
  return new Set(flattenProposal(response).map((it) => it.id));
}
