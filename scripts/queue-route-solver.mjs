// Solveurs de test du parcours de file d'attente : meilleur gain en Nkap et plus court chemin.
import {scoreQueueRoute,routeNeighbours} from '../src/queue-route.ts'
export function allRoutes(board){const routes=[];const walk=(path,seen)=>{const c=path.at(-1);if(c===board.goal){routes.push([...path]);return}for(const n of routeNeighbours(c))if(!seen.has(n)&&!board.blocked.includes(n)){seen.add(n);path.push(n);walk(path,seen);path.pop();seen.delete(n)}};walk([board.start],new Set([board.start]));return routes}
export function bestRoute(board){let best=null,score=-Infinity;for(const p of allRoutes(board)){const t=scoreQueueRoute(board,p);const v=t.nkap+(t.energy+t.mood)*10;if(v>score){score=v;best=p}}return best}
export function shortestRoute(board){return allRoutes(board).sort((a,b)=>a.length-b.length)[0]}
