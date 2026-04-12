import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { GENERAL_ITEMS } from '@/navigation/intranetNavConfig';
import { intranetNavIconForPath } from '@/navigation/intranetNavIcons';
import { useIntranetNavModel } from '@/navigation/useIntranetNavModel';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export { MODULE_GROUPS } from '@/navigation/intranetNavConfig';

export function HorizontalMenu() {
  const { user } = useAuth();
  const nav = useIntranetNavModel();
  const location = useLocation();
  const navigate = useNavigate();

  if (!user || !nav) return null;

  const {
    topItems,
    portalNavItems,
    groups,
    isColaborador,
    hasPortalColaborador,
    hasAnyNonPortalModule,
    canShowChild,
    canShowModule,
    flatMixedLinks,
  } = nav;

  const iconFor = (path: string, label: string) =>
    intranetNavIconForPath(path) ?? <span className="text-[11px] font-bold">{label.split(' ')[0].slice(0, 1)}</span>;

  const itemClass = (active: boolean) =>
    cn(
      'inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm transition-colors whitespace-nowrap',
      active ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
    );

  return (
    <nav className="sticky z-20 top-16 hidden md:block bg-background/95 backdrop-blur-sm border-b border-border/80">
      <div className="mx-auto px-4 sm:px-6 lg:px-8 h-[52px] flex items-center gap-2 overflow-x-auto">
        {hasPortalColaborador && hasAnyNonPortalModule ? (
          <>
            <NavLink
              to="/dashboard"
              className={({ isActive }) => itemClass(isActive || location.pathname === '/dashboard')}
            >
              {iconFor('/dashboard', 'Dashboard')}
              <span className="hidden sm:inline">Dashboard</span>
            </NavLink>

            {GENERAL_ITEMS.filter(i => i.path !== '/dashboard' && canShowModule(i.module)).map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => itemClass(isActive || location.pathname === item.path)}
              >
                {iconFor(item.path, item.label)}
                <span className="hidden sm:inline">{item.label}</span>
              </NavLink>
            ))}

            {portalNavItems.map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => itemClass(isActive || location.pathname === item.path)}
              >
                {intranetNavIconForPath(item.path) ?? (
                  <span className="text-[11px] font-bold">{item.label.split(' ')[0].slice(0, 1)}</span>
                )}
                <span className="hidden sm:inline">{item.label}</span>
                <span className="sm:hidden">{item.label.split(' ')[0]}</span>
              </NavLink>
            ))}

            {flatMixedLinks.map(child => (
              <NavLink
                key={child.path}
                to={child.path}
                className={({ isActive }) => itemClass(isActive || location.pathname === child.path)}
              >
                {iconFor(child.path, child.label)}
                <span className="hidden sm:inline">{child.label}</span>
                <span className="sm:hidden">{child.label.split(' ')[0]}</span>
              </NavLink>
            ))}
          </>
        ) : (
          <>
            {topItems.map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => itemClass(isActive || location.pathname === item.path)}
              >
                {iconFor(item.path, item.label)}
                <span className="hidden sm:inline">{item.label}</span>
              </NavLink>
            ))}

            {isColaborador && portalNavItems.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors">
                    <span className="font-medium">Portal</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  {portalNavItems.map(i => (
                    <DropdownMenuItem key={i.path} onSelect={() => navigate(i.path)}>
                      <span className="flex items-center gap-2">
                        {intranetNavIconForPath(i.path)}
                        {i.label}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {groups.map(g => (
              <DropdownMenu key={g.label}>
                <DropdownMenuTrigger asChild>
                  <button className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors">
                    {g.icon ? <g.icon className="h-4 w-4" /> : null}
                    <span className="font-medium">{g.label}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-72">
                  {g.children.filter(canShowChild).map(child => (
                    <DropdownMenuItem
                      key={child.path}
                      onSelect={() => navigate(child.path)}
                      className={cn(
                        location.pathname.startsWith(child.path) && 'text-primary font-medium',
                      )}
                    >
                      <span className="flex items-center gap-2">
                        {intranetNavIconForPath(child.path)}
                        {child.label}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ))}
          </>
        )}
      </div>
    </nav>
  );
}
