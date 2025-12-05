import React, { useState, useEffect } from 'react';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import { useApp } from '../../contexts/AppContext';
import Notification from '../common/Notification';

const Layout = ({ children }) => {
    const { notification, showNotification } = useApp();
    const [isMobile, setIsMobile] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
            if (window.innerWidth >= 768) {
                setSidebarOpen(false); // Close sidebar when switching to desktop
            }
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
    const closeSidebar = () => setSidebarOpen(false);

    return (
        <div style={{
            display: 'flex',
            height: '100vh',
            overflow: 'hidden',
            background: 'var(--color-bg-primary)'
        }}>
            {/* Sidebar - Responsive */}
            {isMobile ? (
                <>
                    {/* Mobile Sidebar Overlay */}
                    {sidebarOpen && (
                        <div
                            onClick={closeSidebar}
                            style={{
                                position: 'fixed',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                background: 'rgba(0, 0, 0, 0.5)',
                                zIndex: 999,
                                transition: 'opacity 0.3s ease'
                            }}
                        />
                    )}
                    {/* Mobile Sidebar */}
                    <div style={{
                        position: 'fixed',
                        top: 0,
                        left: sidebarOpen ? 0 : '-280px',
                        height: '100vh',
                        zIndex: 1000,
                        transition: 'left 0.3s ease'
                    }}>
                        <Sidebar onClose={closeSidebar} />
                    </div>
                </>
            ) : (
                /* Desktop Sidebar */
                <div style={{ flexShrink: 0 }}>
                    <Sidebar />
                </div>
            )}

            {/* Main Content Area */}
            <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                minWidth: 0,
                overflow: 'hidden'
            }}>
                {/* Navbar */}
                <div style={{ flexShrink: 0 }}>
                    <Navbar onMenuClick={isMobile ? toggleSidebar : undefined} />
                </div>

                {/* Scrollable Content */}
                <main style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: isMobile ? 'var(--spacing-md)' : 'var(--spacing-xl)',
                    maxWidth: '1400px',
                    width: '100%',
                    margin: '0 auto'
                }}>
                    {children}
                </main>
            </div>

            {/* Notification */}
            {notification && (
                <Notification
                    message={notification.message}
                    type={notification.type}
                    onClose={() => showNotification(null)}
                />
            )}
        </div>
    );
};

export default Layout;
