import { NavLink, Outlet } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CI_MODULE_KICKER, CI_MODULE_TITLE, CI_NAV } from '@/modules/controlo-interno/constants';

export function ControloInternoLayout() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{CI_MODULE_KICKER}</p>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-7 w-7 text-primary" aria-hidden />
          <h1 className="page-header">{CI_MODULE_TITLE}</h1>
        </div>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Governança, auditoria institucional, não conformidades, riscos e rastreabilidade centralizada.
        </p>
      </div>

      <nav
        className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin"
        aria-label="Submódulos Controlo Interno"
      >
        {CI_NAV.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/controlo-interno'}
            className={({ isActive }) =>
              cn(
                'shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground',
              )
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}
