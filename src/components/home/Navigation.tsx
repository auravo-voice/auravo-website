import React from 'react';
import { Home, User, Briefcase, Phone } from 'lucide-react';
import { NavBar } from '../ui/tubelight-navbar';


const Navigation = () => {
  const navItems = [
    { name: 'Home', url: '#', icon: Home },
    { name: 'About', url: '#what-is-auravo', icon: User },
    { name: 'Programs', url: '#programs', icon: Briefcase },
    { name: 'Contact', url: '#contact', icon: Phone }
  ];

  return <NavBar items={navItems} />;
};

export default Navigation;