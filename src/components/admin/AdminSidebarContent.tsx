
"use client"

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from '@/components/ui/sidebar';
import Logo from '@/components/shared/Logo';
import { LayoutGrid, List, Layers, Settings, Users, ShoppingBag, Tag, BarChart3, PlaySquare, Settings2, HelpCircle, MessageSquare, ListChecks, Percent, UserCircle as UserProfileIcon, Target, Map, HandCoins, Megaphone, Bell, Activity, Palette, MessageCircle as ChatIcon } from 'lucide-react';
import { useGlobalSettings } from '@/hooks/useGlobalSettings';
import { useLoading } from '@/contexts/LoadingContext';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutGrid },
  { href: '/admin/profile', label: 'Admin Profile', icon: UserProfileIcon },
  { href: '/admin/notifications', label: 'Admin Notifications', icon: Bell },
  { href: '/admin/activity-feed', label: 'Activity Feed', icon: Activity },
  { type: 'separator', label: 'Core Management' },
  { href: '/admin/bookings', label: 'Bookings', icon: Tag },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/chat', label: 'Chat Management', icon: ChatIcon },
  { type: 'separator', label: 'Content Management' },
  { href: '/admin/categories', label: 'Categories', icon: List },
  { href: '/admin/sub-categories', label: 'Sub-Categories', icon: Layers },
  { href: '/admin/services', label: 'Services', icon: ShoppingBag },
  { href: '/admin/slideshows', label: 'Slideshows', icon: PlaySquare },
  { href: '/admin/reviews', label: 'Reviews', icon: MessageSquare },
  { href: '/admin/faq', label: 'FAQ', icon: HelpCircle },
  { type: 'separator', label: 'Location & SEO' },
  { href: '/admin/cities', label: 'Cities', icon: Map },
  { href: '/admin/areas', label: 'Areas', icon: Map },
  { href: '/admin/seo-settings', label: 'Global SEO Patterns', icon: Target },
  { type: 'separator', label: 'Marketing' },
  { href: '/admin/marketing-settings', label: 'Marketing IDs', icon: Megaphone },
  { href: '/admin/newsletter-popups', label: 'Newsletter Popups', icon: Megaphone },
  { href: '/admin/promo-codes', label: 'Promo Codes', icon: Percent },
  { type: 'separator', label: 'Operations & Finance' },
  { href: '/admin/taxes', label: 'Tax Configurations', icon: Percent },
  { href: '/admin/platform-settings', label: 'Platform Fees', icon: HandCoins },
  { href: '/admin/time-slots', label: 'Time Slot Limits', icon: ListChecks },
  { href: '/admin/reports', label: 'Reports', icon: BarChart3 },
  { type: 'separator', label: 'System Settings' },
  { href: '/admin/theme-settings', label: 'Theme Settings', icon: Palette },
  { href: '/admin/settings', label: 'App Settings', icon: Settings },
  { href: '/admin/web-settings', label: 'Web Settings', icon: Settings2 },
];

export default function AdminSidebarContent() {
  const pathname = usePathname();
  const { settings: globalSettings } = useGlobalSettings();
  const { isMobile, setOpenMobile } = useSidebar();
  const { showLoading } = useLoading();

  const handleLinkClick = () => {
    showLoading();
    if (isMobile) {
      setOpenMobile(false);
    }
  };
  
  const uniqueTopLevelAdminPages = ['/admin', '/admin/profile', '/admin/notifications', '/admin/activity-feed', '/admin/theme-settings', '/admin/newsletter-popups', '/admin/chat'];


  return (
    <>
      <SidebarHeader className="p-4 border-b">
        <Logo
          logoUrl={globalSettings?.logoUrl}
          websiteName={globalSettings?.websiteName}
          size="normal"
          href="/admin"
        />
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {navItems.map((item, index) => {
            if (item.type === 'separator') {
              return (
                <div key={`sep-${index}`} className="px-2 py-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{item.label}</span>
                </div>
              );
            }
            let isActiveRoute = pathname === item.href;
            if (uniqueTopLevelAdminPages.includes(item.href!)) {
                isActiveRoute = pathname === item.href;
            } else if (item.href !== '/admin') { 
                isActiveRoute = pathname.startsWith(item.href!);
            }


            return (
            <SidebarMenuItem key={item.href}>
              <Link href={item.href!} passHref legacyBehavior>
                <SidebarMenuButton
                  isActive={isActiveRoute}
                  tooltip={{ children: item.label, side: 'right', align: 'center' }}
                  onClick={handleLinkClick}
                >
                  <item.icon />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          );
        })}
        </SidebarMenu>
      </SidebarContent>
    </>
  );
}

    
