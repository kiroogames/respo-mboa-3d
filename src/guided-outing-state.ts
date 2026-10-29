/* Présentation neutre partagée : évite un cycle entre routines PNJ et moteur des invitations. */
export type GuidedPresentation={npcId:string;mode:'walk'|'taxi'|'yonga'|'moto';phase:'outbound'|'activity'|'return';origin:string;destination:string;zone:string|null;travelling:boolean;progress:number}
let current:GuidedPresentation|null=null
export const isGuidedOutingActive=()=>current!==null
export const getGuidedPresentation=()=>current?{...current}:null
export function setGuidedPresentation(value:GuidedPresentation|null){current=value?{...value}:null}
export function setGuidedProgress(progress:number){if(current)current.progress=Math.max(0,Math.min(1,progress))}
