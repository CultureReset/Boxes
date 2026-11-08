#!/bin/bash -e
# Turn Raspberry Pi OS Lite into the appliance.
#
# Lite plus exactly the X pieces needed, rather than the desktop image: a
# taskbar, file manager and settings daemon on a machine nobody sits at are
# update churn and attack surface for nothing.

install -m 644 files/cybercheck.conf.example  "${ROOTFS_DIR}/boot/firmware/cybercheck.conf"
install -m 755 files/first-boot.sh            "${ROOTFS_DIR}/usr/local/sbin/cybercheck-first-boot"
install -m 755 files/cybercheck-session.sh    "${ROOTFS_DIR}/usr/local/bin/cybercheck-session.sh"
install -m 755 files/cybercheck-mirror.sh     "${ROOTFS_DIR}/usr/local/bin/cybercheck-mirror.sh"

for unit in cybercheck-boot cybercheck-session cybercheck-mirror cybercheck-node; do
  install -m 644 "files/${unit}.service" "${ROOTFS_DIR}/etc/systemd/system/${unit}.service"
done

install -m 644 files/99-android.rules "${ROOTFS_DIR}/etc/udev/rules.d/99-android.rules"
install -d "${ROOTFS_DIR}/opt/cybercheck"
install -m 644 files/docker-compose.yml "${ROOTFS_DIR}/opt/cybercheck/docker-compose.yml"

on_chroot << EOF
curl -fsSL https://get.docker.com | sh
usermod -aG docker,plugdev,video,input cybercheck
systemctl enable docker

# Let a non-root user start X. Without this the session dies at boot with
# "only console users are allowed to run the X server", which looks like a
# hardware fault and is not one.
sed -i 's/^allowed_users=.*/allowed_users=anybody/' /etc/X11/Xwrapper.config 2>/dev/null || \
  echo -e 'allowed_users=anybody\nneeds_root_rights=yes' > /etc/X11/Xwrapper.config

systemctl set-default graphical.target
systemctl enable cybercheck-boot.service
systemctl enable cybercheck-session.service
systemctl enable cybercheck-mirror.service
# The node comes up once first-boot has confirmed a network.
systemctl disable cybercheck-node.service || true
EOF
