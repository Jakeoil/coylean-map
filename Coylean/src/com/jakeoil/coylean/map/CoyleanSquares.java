package com.jakeoil.coylean.map;

import android.app.Activity;
import android.os.Bundle;
import android.content.Intent;
import android.view.View;
import android.view.View.OnClickListener;
import android.view.Menu;
import android.view.MenuInflater;
import android.view.MenuItem;
import android.app.AlertDialog;
import android.content.DialogInterface;
import android.util.Log;
//import android.media.MediaPlayer;
//import android.os.Parcelable;

public class CoyleanSquares extends Activity implements OnClickListener {
    /** Called when the activity is first created. */
   int mPosition;
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.main);
        // Set up click listeners for all the buttons
        View continueButton = findViewById(R.id.continue_button);
        continueButton.setOnClickListener(this);
        View newButton = findViewById(R.id.new_map_button);
        newButton.setOnClickListener(this);
        View aboutButton = findViewById(R.id.about_button);
        aboutButton.setOnClickListener(this);
        View exitButton = findViewById(R.id.exit_button);
        exitButton.setOnClickListener(this);
        mPosition = savedInstanceState != null ? savedInstanceState.getInt("position", 0) : 0;
    }
    public void onClick(View v)
    {
       switch(v.getId())
       {
       case R.id.about_button:
          Intent i = new Intent(this, About.class);
          startActivity(i);
          break;
       case R.id.new_map_button:
          openNewMapDialog();
          break;
       case R.id.exit_button:
          finish();
          break;
       }
    }
    @Override
    public boolean onCreateOptionsMenu(Menu menu)
    {
       super.onCreateOptionsMenu(menu);
       MenuInflater inflater = getMenuInflater();
       inflater.inflate(R.menu.view_menu, menu);
       return true;
    }
    @Override
    public boolean onOptionsItemSelected(MenuItem item)
    {
       switch(item.getItemId())
       {
       case R.id.settings:
          startActivity(new Intent(this,Prefs.class));
          return true;
       }
       return false;
    }
    private static final String TAG = "Coylean";
    private void openNewMapDialog()
    {
       new AlertDialog.Builder(this)
          .setTitle(R.string.new_map_title)
             .setItems(
                R.array.complexity, 
                new DialogInterface.OnClickListener()
                {
                   public void onClick(
                      DialogInterface dialoginterface,
                      int i)
                   {
                      startMap(i);
                   }
                }).show();
       
    }
    private void startMap(int i)
    {
       Log.d(TAG, "clicked on"+i);
       Intent intent = new Intent(this,Map.class);
       intent.putExtra(Map.KEY_COMPLEXITY,i);
       startActivity(intent);
    }

    @Override protected void onResume(){
       super.onResume();
       Music.play(this,R.raw.quartet,mPosition);
    }

    @Override protected void onSaveInstanceState(Bundle outState) 
    {
       outState.putInt("position", mPosition);
       super.onSaveInstanceState(outState);
    }

    @Override protected void onPause(){
       super.onPause();
       mPosition = Music.stop(this);
    }
            
    
}