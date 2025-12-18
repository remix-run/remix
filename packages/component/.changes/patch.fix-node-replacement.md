Fix node replacement

Anchors were being calculated incorrectly because it removed the old node before inserting the new one, Now it correctly uses the old node as the anchor for insertion and inserts the new node before removing the old one.
